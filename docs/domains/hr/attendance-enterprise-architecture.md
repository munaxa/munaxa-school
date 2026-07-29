# HR × Attendance — Enterprise Architecture Audit & Evolution Plan

_Lead Principal Architect review of the Munaxa HR and Attendance domains.
Grounded entirely in the current source tree — every "exists" claim below cites
a real file/model. Documentation only; no code changed. Implementation (Phase 4)
is gated on plan sign-off and proceeds one atomic PR at a time._

Companion docs: `ATTENDANCE_STRUCTURE_UI.md`, `HR_MODULE_CONNECTIONS.md`.

---

# Phase 1 — Architecture Audit

## 1.1 What exists today (verified in-repo)

### Bounded contexts (correctly separated — keep as-is)

| Context | Root | Attendance table | Location |
|---------|------|------------------|----------|
| **HR / People** | `Employee` | `StaffAttendance` | `apps/api/src/people/attendance` |
| **Academics** | `Section`, `Teacher` | `StudentAttendance`, `TeacherAttendance` | `apps/api/src/attendance` |
| **Presence/Transport arrival** | `StudentPresenceEvent`, `BusAttendanceEvent` | (student gate/bus) | `apps/api/src/presence` |

These three attendance stores are **already** distinct bounded contexts with
their own tables, controllers, permissions, and RLS. **Rule 1–3 are already
satisfied by the current design.** The evolution must preserve this, not merge it.

### HR domain (People) — mature

- `PeopleModule` (root aggregate `Employee`), `EmployeeRecordsModule`,
  `LeaveModule`, `StaffAttendanceModule`, `PerformanceModule`, `TrainingModule`,
  `AssetModule`, `RecruitmentModule`, `SelfServiceModule`, `HrDashboardModule` —
  all registered in `app.module.ts`.
- **Employee lifecycle state machine** — `employee-lifecycle.logic.ts` (pure, 16
  `EmploymentStatus`, transition graph, unit-tested). Reused by recruitment.
- **Leave** — multi-level approval, balance deduction, `workingDaysBetween`
  (`leave-days.logic.ts`, Fri/Sat weekend). `LeaveService` exported & reused.
- **Staff attendance** — `StaffAttendance` model with `source`
  (`MANUAL|QR|BIOMETRIC|GPS|MOBILE`), `lateMinutes`, `overtimeHours`, and an
  **in-place correction trail** (`correctedFromStatus/ById/At`). Record + bulk +
  audit in `attendance.repository.ts`.
- **Payroll prep** — `payroll-prep.logic.ts` (pure: present/remote/absent/late,
  `payableDays = workingDays − absent − unpaidLeave`) + CSV/xlsx/pdf via
  `ExportService`. Money deliberately excluded.

### Academics attendance — offline-first

- `StudentAttendance` — idempotent bulk upsert on
  `(tenant, student, date, classNumber)`; QR marking; timetable-resolved current
  class (`SchedulingService.getCurrentSectionClass`).
- `TeacherAttendance` — daily `PRESENT|ABSENT|LATE|ON_LEAVE`, upsert on
  `(tenant, teacher, date)`.
- **Mobile offline engine** — durable write-ahead queue + connectivity-drain
  (`apps/mobile/lib/data/attendance`), server idempotency makes replays safe.

### Scheduling / substitution — **already handles substitutes**

- `ScheduleException` model + `ScheduleExceptionService`: date-specific
  `CANCELLATION | SUBSTITUTION | REPLACEMENT | HOLIDAY`, per-section or
  school-wide, carrying **`substituteTeacherId`**, `teacherId`, `subjectId`,
  `locationId`. The scheduling engine overlays these on the master timetable.
- Ramadan alternate schedule + `TimetableConfig` (per-campus, timezone-aware).

### Cross-cutting platform (reuse — do NOT rebuild)

| Capability | What exists | File |
|------------|-------------|------|
| **Domain event bus** | `DomainEvents` — in-process Node `EventEmitter`, isolated async handlers, fire-and-forget. **7 event types**, 1 producer (students). | `apps/api/src/events/domain-events.ts` |
| **Notification engine** | **Enterprise-grade**: `NotificationEventBus` + `NotificationEngine`, channels (email/push/whatsapp), preferences, templates, in-process queue **port**, priority engine, idempotency/dedupe, audit, tenant kill-switches. | `apps/api/src/communication/**` |
| **Notification events** | Catalog incl. `AttendanceMarked`, `StudentAbsent`, `StudentLate`, `LeaveApproved/Rejected`, `SchoolClosure`, `EmergencyAlert`. | `communication/engine/notification-events.ts` |
| **Reporting/export** | `ExportService.render(ReportTable, csv\|xlsx\|pdf)`; generic `ReportTable`. | `apps/api/src/reporting` |
| **Tenant isolation** | RLS on every table (`tenant_isolation`), `TenantRepository.run((tx, tenantId)=>…)`, `TenantContextStore.actorUserId`. | `common/tenant.repository.ts`, `prisma/tenant-context.ts` |
| **Audit** | `writeAudit` on repositories; `AuditLog` model. | e.g. `people/attendance/attendance.repository.ts` |
| **Webhooks** | Outbound webhook fan-out subscribing to `DomainEvents`. | `apps/api/src/webhooks` |

### Employee ↔ Teacher ↔ Driver bridges (exist)

- `Employee.teacher` (1-1 → academic `Teacher`).
- `Employee.driverProfile` + `busesDriven` (`DriverProfile`, `Bus`), from the
  Phase-3 driver refactor (`people/employee-records/driver.*`).
- Transport is **model-only** on the API today: `BusRoute`, `Bus`, `BusStop`,
  `BusAttendanceEvent`, `TransportFare` exist in schema; referenced mainly by
  finance (fees). No transport *service* module in `apps/api/src`.

## 1.2 Existing connections (today)

```
Recruitment ──hire()──► EmployeeService ──► Employee(HIRED)         [PeopleModule export]
Leave.approve (final) ──► StaffLeaveBalance deduction               [workingDaysBetween]
Payroll prep ◄── StaffAttendance + approved Leave                   [shared workingDaysBetween]
SelfService ──delegates──► Leave / StaffAttendance / Asset / Perf / Training
Students ──emit──► DomainEvents ──► usage / webhooks
* ──emit──► NotificationEventBus ──► NotificationEngine ──► channels
Timetable + ScheduleException(SUBSTITUTION) ──► resolved day (substitute teacher)
```

## 1.3 Gaps / missing integrations (the real greenfield)

| # | Gap | Evidence it's missing |
|---|-----|-----------------------|
| G1 | **HR ↔ Teacher attendance sync** — a teacher-employee absent in `StaffAttendance` does not surface in `TeacherAttendance`/academics, and vice-versa. Two stores, no bridge. | No cross-context handler; grep for teacher↔staff sync = none. |
| G2 | **Shift management** — no `Shift`/`WorkSchedule` model. Expected check-in/out, grace, breaks, overtime window are not modelled; `lateMinutes` is supplied by the caller, not derived. | `grep model .*Shift` = none. |
| G3 | **Attendance policy engine** — thresholds live as DTO `@Max` bounds and hardcoded logic in `payroll-prep.logic.ts` (`PRESENT|LATE|EARLY_DEPARTURE→present`). Not data-driven/per-tenant. | No policy model; logic embedded. |
| G4 | **Calendar-aware working days** — `leave-days.logic.ts` only excludes Fri/Sat and self-documents "Full public-holiday-calendar awareness is layered on later." No first-class holiday calendar (only `ScheduleException` HOLIDAY + Ramadan). | Comment in file; `grep model .*Holiday/Calendar` = none. |
| G5 | **Biometric provider layer** — `StaffAttendanceSource` enum has `BIOMETRIC/GPS/MOBILE` values but there is **no provider abstraction/interface**; nothing ingests device events. | No provider port; enum only. |
| G6 | **Driver attendance → Transport events** — driver is an employee, but a driver absence raises no transport signal. | No transport consumer; transport = model-only. |
| G7 | **Teacher availability service** — availability is implicit (substitution exists) but there's no queryable "can this teacher teach today?" service for the scheduler. | No availability service. |
| G8 | **Attendance-specific notifications** — engine exists but staff events (MissedCheckIn, OvertimeApproved, AttendanceLocked, CorrectionRequested…) are not in the catalog. | `notification-events.ts` lacks them. |
| G9 | **Attendance locking** — no daily/weekly/payroll/semester lock; corrected rows are editable. | No lock model. |
| G10 | **Correction *workflow*** — only an in-place trail; no request→manager→HR approval, no evidence/attachment, no immutable versioned history. | `StaffAttendance` trail is single-level, in-place. |
| G11 | **Attendance analytics** — no reusable analytics service (trends/heatmaps/utilization). Dashboard reads raw counts. | No analytics module under attendance. |
| G12 | **Payroll pipeline stages** — only *preparation* exists; validation→calculation→approval→payslip→finance-posting are absent (finance module exists to receive postings). | `payroll-prep` only. |

## 1.4 Risks

- **R1 — Dual event buses.** `DomainEvents` (generic) and `NotificationEventBus`
  (notifications) coexist. Adding attendance domain events must extend the
  **existing** `DomainEvents` (Rule 4) and let notifications subscribe — not
  invent a third bus.
- **R2 — In-process events are not durable.** Both buses are in-memory
  fire-and-forget. Cross-context workflows that must not be lost (payroll lock,
  correction approval) need a **transactional outbox**, or they break "idempotent
  / retry / horizontal scaling" NFRs.
- **R3 — `lateMinutes` is caller-supplied.** Until a Shift+Policy engine derives
  it, analytics/payroll trust unvalidated input.
- **R4 — Calendar divergence.** Leave and payroll share `workingDaysBetween`, but
  a naive holiday addition in one place would fork the rule. Must extend the one
  shared helper (Rule 4).
- **R5 — Migration safety.** New columns/tables must be additive, RLS-enabled,
  and grant `munaxa_app`, matching `20260723160000_hr_staff_attendance`.

## 1.5 Duplicate logic (must reuse, not fork)

- ✅ **Reuse** `workingDaysBetween` (leave-days.logic) — the single weekend rule.
- ✅ **Reuse** `summarizeAttendance` / `payroll-prep.logic` — no second tally.
- ✅ **Reuse** `ScheduleException(SUBSTITUTION)` for substitute teachers — do not
  build a parallel substitution table.
- ✅ **Reuse** `NotificationEngine` — never touch FCM/Resend directly.
- ✅ **Reuse** `ExportService`/`ReportTable` for analytics exports.
- ✅ **Reuse** `TenantRepository` + `writeAudit` for every new table.

## 1.6 Opportunities

- The **`DomainEvents` bus is under-used** (1 producer). It is the natural spine
  for HR↔Academics↔Transport decoupling (Rule: events replace tight coupling).
- **`StaffAttendanceSource` already anticipates biometrics** — a provider port
  slots in cleanly behind the existing `record()`.
- **`ScheduleException` already carries substitutes** — Teacher Availability is a
  *read model* over existing data, not new writes.
- **Correction trail → workflow** is an extension, not a rewrite: keep the
  existing columns, add a request/approval table that lands a correction through
  the existing `record()`.

## 1.7 Explicitly-correct-as-is (do NOT change)

- The three-store separation (Rules 1–3). **Unchanged.**
- `Employee` as HR aggregate root. **Unchanged.**
- `workingDaysBetween` signature & weekend rule. **Extended, not replaced.**
- `payroll-prep.logic.ts` tally. **Consumed by new pipeline, not rewritten.**
- Offline mobile queue + idempotent bulk endpoint. **Unchanged.**
- `NotificationEngine` internals. **Only the event catalog is extended.**

---

# Phase 2 — Architecture Proposal

## 2.1 Guiding principle

Everything new is **additive and event-driven**. HR emits facts; Academics and
Transport subscribe. No context imports another's services (no circular deps).
The shared kernel (`DomainEvents`, calendar, policy) is injected, never forked.

## 2.2 Target module map (new pieces in **bold**)

```
                    ┌────────────────────── Shared Kernel ──────────────────────┐
                    │  DomainEvents (extended)   Scheduling holiday port (ext.)  │
                    │  NotificationEngine        AttendancePolicy config (conv.) │
                    └───────▲───────────────────────────▲────────────────────────┘
                            │ inject                     │ inject
  ┌──── HR (People) ────────┴──────┐        ┌──── Academics ─┴─────────────┐
  │ Employee (root)                │        │ Teacher / Section            │
  │ StaffAttendance                │  emit  │ TeacherAttendance            │
  │  **+ Shift, Policy binding**   │ ─────► │  **← StaffAttendanceSync**   │
  │  **+ Lock, CorrectionRequest** │ events │ **TeacherAvailability (read)**│
  │  **+ BiometricProvider port**  │        └──────────────────────────────┘
  │  Leave · PayrollPrep           │  emit  ┌──── Transport ───────────────┐
  │  **→ PayrollValidation stage** │ ─────► │ Bus / BusRoute / Driver      │
  └────────────────┬───────────────┘ events │ **← DriverAttendanceSync**   │
                   │ emit                    └──────────────────────────────┘
                   ▼
          NotificationEngine ──► email / push / sms / in-app / webhook
```

## 2.3 Evolution Decision Register (extend-over-new — burden of proof discharged)

Per the highest-priority evolution principle, every proposed artifact was tested
against "does a canonical owner already exist?" with repository-wide searches.
Result: **only 4 genuinely-new aggregates are justified**; everything else is an
extension of an existing canonical system. Corrections to my initial Phase-2
framing are called out as ⚠︎.

| # | Capability | Canonical owner (verified) | Decision | Evidence / justification |
|---|-----------|----------------------------|----------|--------------------------|
| 1 | Teacher-attendance sync | `DomainEvents` bus + `Employee.teacher` bridge + `TeacherAttendance` | **EXTEND** | New *thin subscriber service* in Academics; writes into existing `TeacherAttendance`. No new table, no new bus — only new event types. |
| 2 | Shift engine | — (none: `grep shift/roster/duty` = 0 hits) | **NEW aggregate** | No work-schedule concept exists; `lateMinutes` is caller-supplied. Justified new `Shift` (+ assignment) in HR + pure `shift-window.logic.ts`. |
| 3 | Policy engine | Per-context config convention: `BillingPolicy`, `TimetableConfig`, `allocation-policy.ts`, `preference.policy.ts` | **EXTEND convention** | Follows the established "config row + pure `*.logic.ts`" pattern, HR-scoped. **Not** a generic rules engine (none exists; inventing one = competing abstraction). |
| 4 | Academic calendar / working-days | ⚠︎ **scheduling** `ScheduleException(HOLIDAY)` + Ramadan; `workingDaysBetween` | **EXTEND scheduling** | ⚠︎ *Correction to Phase 2:* do **not** add an HR `AcademicCalendar` model — that duplicates the holiday source of truth. `AcademicYear/Semester` model only instructional bounds. Extend `ExceptionType` with non-instructional day types (TRAINING/EXAM/CLOSURE/SPECIAL_WORKING) and extend the **one** `workingDaysBetween` to consult scheduling via an injected port. |
| 5 | Biometric provider layer | Attendance ingestion `AttendanceService.record()`; `StaffAttendanceSource` enum (already has `BIOMETRIC/GPS/MOBILE`) | **EXTEND** | New provider *interface* + adapters normalize to a punch → existing idempotent `record()`. Optional raw-punch log only if audit requires it. No parallel ingestion path. |
| 6 | Driver→Transport | `DomainEvents` bus + `DriverProfile`/`Bus` models | **EXTEND** | Transport is model-only today; add a *subscriber service* on the existing event bus + models. No new transport aggregate. |
| 7 | Teacher availability | Existing `TeacherAttendance` + `ScheduleException(SUBSTITUTION)` + `LeaveService` | **EXTEND (read-model)** | Compose a query service over existing data. **No new writes/table** — substitution already exists; availability is a projection. |
| 8 | Attendance notifications | ⚠︎ **`NotificationEngine`** + `notification-events.ts` catalog | **EXTEND catalog only** | Pure additive entries in the existing catalog; producers emit through the existing engine. Never touch channels directly. |
| 9 | Attendance locking | — (none: `grep model .*Lock` = only `BillingPolicy`, no lock) | **NEW aggregate** | No lock concept exists. New `AttendanceLock` in HR; the write-guard reuses the existing `record()`/bulk path. |
| 10 | Correction workflow | ⚠︎ Existing in-place trail (`correctedFromStatus/ById/At`) + **leave approval pattern** (`decide()`, `requiredLevels/currentLevel`) | **EXTEND + reuse pattern** | Keep the existing trail. New `AttendanceCorrectionRequest` table **modeled on the proven leave approval shape** (per-context approval is the repo convention; finance & leave each have their own). Applies through existing `record()`. No generic workflow engine. |
| 11 | Analytics | ⚠︎ **`HrDashboardService`** + `reporting`/`ExportService`/`ReportTable` | **EXTEND** | ⚠︎ *Correction:* not a new analytics abstraction. Extend the HR dashboard/reporting pattern; emit `ReportTable` datasets through the existing export pipeline. |
| 12 | Payroll pipeline | Existing `payroll-prep.logic.ts` + Finance module | **EXTEND** | Add a `Validated` gate (lock + policy applied) *in front of* the existing prep output; reuse `summarizeAttendance`. Finance still owns calc/payslip/posting. No second tally. |
| 13 | Domain events | ⚠︎ **`DomainEvents`** (`events/domain-events.ts`) | **EXTEND union (+ optional outbox)** | Extend the existing union with attendance facts. Optional transactional **outbox is a durability layer under the same bus**, not a new bus. No third event system (the notification bus stays a *subscriber*, not a duplicate). |

**Net new tables (only where extension is impossible):** `Shift` (+
`EmployeeShiftAssignment`), `AttendancePolicy`, `AttendanceLock`,
`AttendanceCorrectionRequest`, and optionally `BiometricRawPunch` / `EventOutbox`.
**Everything else is service / event-catalog / logic extension.** No new event
bus, no new notification path, no new calendar source of truth, no new analytics
or approval abstraction.

## 2.3.1 Why each change (mapped to the 13 asks)

| Ask | Design | Why (and what it reuses) |
|-----|--------|--------------------------|
| 1 Teacher-attendance sync | `StaffAttendanceSyncService` in **Academics** subscribes to `StaffAttendanceRecorded`; for teacher-employees, projects status into `TeacherAttendance`. Reverse: HR subscribes to `TeacherMarkedAbsent`. | Decouples via `DomainEvents`; reuses `Employee.teacher` bridge; substitute already via `ScheduleException`. |
| 2 Shift engine | New `Shift` + `EmployeeShiftAssignment` models (campus/role/teacher/driver scoped); all thresholds columns. A pure `shift-window.logic.ts` derives late/early/overtime from stamps. | Nothing hardcoded; `lateMinutes` becomes derived, fixing R3. |
| 3 Policy engine | New `AttendancePolicy` (data-driven rules per tenant/campus) + pure `attendance-policy.logic.ts`. Payroll/analytics consume it. | Removes embedded thresholds (G3); pure + testable like existing `*-.logic.ts`. |
| 4 Calendar-aware days | **`AcademicCalendar`** model (public/school/training/exam/closure/special-working days) + extend `workingDaysBetween` → `workingDaysBetween(from,to,calendar)` with a **calendar port** injected into leave & payroll. | Extends the ONE shared helper (Rule 4, fixes R4/G4); reuses `ScheduleException` HOLIDAY as a source. |
| 5 Biometric layer | `BiometricProvider` interface + registry; adapters (Fingerprint/Face/RFID/NFC/QR/GPS/REST/SDK) normalize to a `RawPunch` → existing `AttendanceService.record()`. | Enum already anticipates it (G5); no vendor lock-in; ingestion is idempotent. |
| 6 Driver→Transport | Transport-side `DriverAttendanceSyncService` subscribes to `DriverMarkedAbsent/Late`; raises transport signals + notifications. | Transport stays independent (events only, G6). |
| 7 Teacher availability | `TeacherAvailabilityService` (read model) folds `TeacherAttendance` + `StaffAttendance` sync + `ScheduleException` + Leave into `{ canTeach, unavailable, substituted, onLeave, training, meeting, emergency }`. | No new writes; scheduler consumes it (G7). |
| 8 Notifications | Extend `notification-events.ts` catalog with staff attendance events; producers emit through the existing engine. | Reuses engine entirely (G8). |
| 9 Locking | `AttendanceLock` model (scope: DAY/WEEK/PAYROLL/SEMESTER, status, approval, audit). `record()`/bulk reject writes to a locked window. | Immutable history; approval workflow (G9). |
| 10 Corrections | `AttendanceCorrectionRequest` (+ evidence attachment) → manager review → HR approval → applies via existing `record()`, versioned. | Keeps existing trail; adds workflow (G10). |
| 11 Analytics | `AttendanceAnalyticsService` producing export-ready `ReportTable` datasets (late/absence trends, heatmaps, utilization, leave/payroll impact). | Dashboard logic stays in UI; reuses `ExportService` (G11). |
| 12 Payroll pipeline | Stage machine: `Prepared → Validated → Calculated → Approved → Payslip → Posted`. This program delivers **Validated** (attendance-locked + policy-applied summary) and a clean hand-off contract; calculation/payslip remain finance's. | Payroll stays separate; only clean summaries cross (G12). |
| 13 Domain events | Extend `DomainEvents` union with the attendance lifecycle facts + add a **transactional outbox** for the must-not-lose ones. | Events replace coupling; fixes R2. |

## 2.4 Event flow (canonical example — teacher absence)

```
HR marks employee ABSENT
  AttendanceService.record()  ── within tx ──►  StaffAttendance row + AuditLog + Outbox row
  commit
  Outbox dispatcher ──► DomainEvents.emit({ StaffAttendanceRecorded, employeeId, status, date })
     ├─► [Academics] StaffAttendanceSync: employee.teacher? → upsert TeacherAttendance(ABSENT)
     │        └─► emit TeacherUnavailable → TeacherAvailability read-model invalidation
     ├─► [Transport] DriverAttendanceSync: employee.driverProfile? → raise DriverAbsent signal
     └─► [Notifications] NotificationEngine: notify manager/HR (existing channels)
```

No context imports another. Each subscriber is idempotent and isolated (a
throwing handler never breaks peers — existing bus guarantee).

## 2.5 Data ownership

| Data | Owner context | Others get it via |
|------|---------------|-------------------|
| `StaffAttendance`, `Shift`, `AttendancePolicy`, `AttendanceLock`, `CorrectionRequest` | **HR** | events / read APIs |
| `TeacherAttendance`, availability | **Academics** | sync projection (write owned by Academics) |
| Driver duty status | **Transport** | events |
| Holiday / non-instructional days | **Scheduling** (`ScheduleException` — extended, not a new calendar) | injected holiday **port** into HR |
| Notifications, channels | **Communication** | engine (subscribe) |
| Payslip, posting | **Finance** | validated summary contract |

The **projection rule**: sync *writes into the consumer's own table* (Academics
owns `TeacherAttendance` writes), so no context mutates another's aggregate.

---

# Phase 3 — Implementation Plan (atomic PRs)

Each PR compiles independently, is additive (no breaking API/schema changes),
ships with migration safety (additive + RLS + `munaxa_app` grant), and includes
unit + (where applicable) integration/e2e tests. Validation after every PR:
`typecheck → eslint → prisma validate → unit → e2e`.

**Sequencing is dependency-ordered.** Foundations first.

| PR | Title | Extend/New | Scope (canonical owner) | Depends on |
|----|-------|-----------|-------------------------|-----------|
| **PR-0** | Guardrail baseline | — | e2e coverage snapshot for current attendance/payroll so regressions are caught. No prod code. | — |
| **PR-1** | Attendance domain-event catalog | **EXTEND** `events` | Extend the existing `DomainEvents` union with attendance facts. Producers emit; **no consumers yet**. (Optional `EventOutbox` durability layer deferred to PR-1b only if a lost event is unacceptable.) | — |
| **PR-2** | Calendar-aware working days | **EXTEND** `scheduling` | Extend `ExceptionType` with non-instructional day types; expose a holiday **port** from scheduling; extend the single `workingDaysBetween(from,to,calendar?)` (default = today's Fri/Sat behavior). Wire leave + payroll behind the port. **No new calendar model.** | — |
| **PR-3** | Attendance policy config | **EXTEND** convention | `AttendancePolicy` config row + pure `attendance-policy.logic.ts`, following the `BillingPolicy`/`TimetableConfig` convention. Default policy = current constants (zero behavior change). | PR-2 |
| **PR-4** | Shift engine | **NEW** aggregate (HR) | `Shift` + `EmployeeShiftAssignment` + pure `shift-window.logic.ts` deriving late/early/overtime. `record()` auto-derives when a shift is assigned (opt-in). | PR-3 |
| **PR-5** | Teacher-attendance sync | **EXTEND** `academics` | Thin subscriber service projects PR-1 events into existing `TeacherAttendance`; reverse handler. Idempotent. No new table. | PR-1 |
| **PR-6** | Teacher availability read-model | **EXTEND** (compose) | `TeacherAvailabilityService` folds existing `TeacherAttendance` + `ScheduleException` + `LeaveService`. Scheduler consumes. No new writes. | PR-5 |
| **PR-7** | Driver→Transport sync | **EXTEND** (subscriber) | Transport-side subscriber on the existing bus + `DriverProfile`/`Bus` models. No new transport aggregate. | PR-1 |
| **PR-8** | Attendance notifications | **EXTEND** catalog | Additive entries in `notification-events.ts` (MissedCheckIn, OvertimeApproved, AttendanceLocked, Correction*…); emit via the existing engine. | PR-1 |
| **PR-9** | Attendance locking | **NEW** aggregate (HR) | `AttendanceLock` + write-guard reusing existing `record()`/bulk; approval + audit; emits `AttendanceLocked`. | PR-1, PR-8 |
| **PR-10** | Correction workflow | **NEW** table, **reuse** leave pattern | `AttendanceCorrectionRequest` (+ evidence) modeled on the leave approval shape; applies through existing `record()`; respects locks; keeps existing trail. No generic workflow engine. | PR-9 |
| **PR-11** | Biometric provider layer | **EXTEND** ingestion | `BiometricProvider` interface + registry + normalizing endpoint → existing idempotent `record()`. Adapters per provider. Enum already exists. | PR-4 |
| **PR-12** | Attendance analytics | **EXTEND** `hr-dashboard`/`reporting` | Extend the dashboard/reporting pattern; emit `ReportTable` datasets through the existing `ExportService`. No new analytics abstraction. | PR-3 |
| **PR-13** | Payroll `Validated` stage | **EXTEND** `payroll-prep` | Add a `Validated` gate (locked window + applied policy) in front of existing prep output; reuse `summarizeAttendance`. Finance owns the rest. | PR-9, PR-3 |
| **PR-14** | Admin/mobile UI | **EXTEND** design system | Shift admin, policy admin, lock controls, correction inbox, analytics views on the existing components. | prior |

**Complexity check (per PR):** every PR either adds a subscriber/config/logic to
an existing owner or introduces one of the 4 justified new aggregates. None forks
a bus, tally, calendar, approval, or notification path. The architecture's
*number of canonical owners per capability stays at one.*

Every PR preserves tenant isolation, RLS, audit, offline-first, idempotency, and
existing APIs (all new endpoints are additive; existing endpoints unchanged).

---

# Phase 4 — Implementation

Gated: proceeds one PR at a time with full validation between PRs, starting at
**PR-0 → PR-1**. See the recommendation in chat for the immediate next step.
No code is written until the plan/sequence is confirmed, per the mandate that the
audit precede any code.
