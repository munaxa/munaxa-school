# Capability Ownership Matrix — Munaxa School OS

_Single source of truth for **who owns what**. Every code change in the HR ×
Attendance evolution program is verified against this matrix BEFORE
implementation. One business capability → one canonical owner. Grounded in the
current source tree._

Legend: **AR** = Aggregate Root · **DB Owner** = the module whose migrations own
the table · **Ext** = sanctioned extension point.

---

## Part A — Canonical capabilities (existing, must evolve — never replace)

### C1 · Domain Event Bus
- **Canonical Owner:** `apps/api/src/events` (`DomainEvents`, `EventsModule` `@Global`)
- **DB Owner:** none (in-process `EventEmitter`)
- **AR:** n/a (infrastructure)
- **Public API:** `DomainEvents.emit(event)`, `DomainEvents.subscribe(handler)`
- **Events Published:** union in `domain-events.ts` (`StudentCreated`, `CampusCreated`, …)
- **Consumers:** usage/subscription metering, webhooks
- **Extension Points:** **add variants to the `DomainEvent` union**; add subscribers
- **Forbidden Duplications:** no second event bus; the notification bus is a *subscriber*, not a peer

### C2 · Notification / Communication
- **Canonical Owner:** `apps/api/src/communication`
- **DB Owner:** communication (notifications, preferences, templates, devices, delivery)
- **AR:** `Notification`
- **Public API:** `NotificationEventBus.publish(NotificationEvent)`; engine + channels internal
- **Events Published:** delivery/audit internal
- **Events Consumed:** `NotificationEventType` catalog (`AttendanceMarked`, `StudentAbsent`, `LeaveApproved`, …)
- **Consumers:** email/push/whatsapp channels, in-app
- **Extension Points:** **add entries to `notification-events.ts`**; add templates
- **Forbidden Duplications:** never call FCM/Resend directly; no ad-hoc notification tables

### C3 · Scheduling / Timetable / Calendar overrides
- **Canonical Owner:** `apps/api/src/scheduling`
- **DB Owner:** scheduling (`SectionTimetable`, `BellSchedule`, `ScheduleException`, `TimetableConfig`, Ramadan)
- **AR:** `SchedulePlan` / `SectionTimetable`; `ScheduleException` for date overrides
- **Public API:** `SchedulingService.getCurrentSectionClass()`, resolver; exception CRUD
- **Events Published:** none today (Ext point)
- **Consumers:** student attendance (current class), timetable UI, mobile
- **Extension Points:** **`ExceptionType` enum** (holiday/substitution/…); resolver; a **holiday/working-day port** derived from `ScheduleException(HOLIDAY)`
- **Forbidden Duplications:** **no separate "AcademicCalendar" holiday model** — this owner is canonical for "what kind of day is a date"; no parallel substitution table (SUBSTITUTION already here)

### C4 · Student Attendance
- **Canonical Owner:** `apps/api/src/attendance/students`
- **DB Owner:** `StudentAttendance` (Academics)
- **AR:** `StudentAttendance` (keyed `tenant+student+date+classNumber`)
- **Public API:** `/attendance/students/{bulk,qr,summary,current-class,:id/history}`
- **Events Published:** (Ext) none yet → notifications go via C2
- **Consumers:** mobile offline queue, parent/student portals, dashboard summary
- **Extension Points:** ingestion sources; analytics read models
- **Forbidden Duplications:** never merged with staff/teacher attendance (separate bounded context)

### C5 · Teacher Attendance
- **Canonical Owner:** `apps/api/src/attendance/teachers`
- **DB Owner:** `TeacherAttendance` (Academics)
- **AR:** `TeacherAttendance` (keyed `tenant+teacher+date`)
- **Public API:** `POST/GET /attendance/teachers`
- **Events Published:** (Ext) `TeacherMarkedAbsent` planned
- **Events Consumed:** (Ext) HR `StaffAttendanceRecorded` → projection (PR-5)
- **Consumers:** teacher availability read-model (PR-6), scheduling
- **Extension Points:** sync projection service; availability read-model
- **Forbidden Duplications:** teacher data never duplicated — linked to `Employee` via `Employee.teacher`

### C6 · Staff Attendance (HR)
- **Canonical Owner:** `apps/api/src/people/attendance` (`StaffAttendanceModule`)
- **DB Owner:** `StaffAttendance` (HR)
- **AR:** `Employee` → `StaffAttendance`
- **Public API:** `/hr/attendance`, `/hr/attendance/bulk`, `/employees/:id/attendance`, `/hr/payroll-prep`
- **Events Published:** (Ext) `StaffAttendanceRecorded/Corrected/Locked`, `DriverMarkedAbsent`, `OvertimeApproved`
- **Events Consumed:** (Ext) biometric punches → `record()`
- **Consumers:** payroll prep, self-service, HR dashboard, (new) academics/transport sync
- **Extension Points:** `record()`/`bulkRecord()` are the single write path; `StaffAttendanceSource` enum; correction trail
- **Forbidden Duplications:** all staff attendance writes go through `record()`/`bulkRecord()`; no second tally

### C7 · Payroll Preparation
- **Canonical Owner:** `apps/api/src/people/attendance` (`payroll-prep.logic.ts`, `AttendanceService.payrollPrep`)
- **DB Owner:** reads `StaffAttendance` + leave; owns no new table
- **AR:** n/a (pure aggregation)
- **Public API:** `GET /hr/payroll-prep?from&to&format`
- **Extension Points:** **add a `Validated` gate in front** (lock+policy); reuse `summarizeAttendance`
- **Forbidden Duplications:** exactly one attendance tally (`summarizeAttendance`); money stays in Finance

### C8 · Leave
- **Canonical Owner:** `apps/api/src/people/leave` (`LeaveService`, `leave-days.logic.ts`)
- **DB Owner:** `StaffLeaveType/Balance/Request` (HR)
- **AR:** `StaffLeaveRequest`
- **Public API:** `/hr/leave*`, `/employees/:id/leave*`
- **Extension Points:** `workingDaysBetween` (the **one** weekend/working-day helper — to become calendar-aware); the multi-level `decide()` **approval pattern** (reused by corrections)
- **Forbidden Duplications:** one working-day helper; one leave balance ledger

### C9 · HR Analytics / Dashboard
- **Canonical Owner:** `apps/api/src/people/hr-dashboard` (`HrDashboardService`)
- **DB Owner:** none (aggregation) — exports via C10
- **Public API:** `/hr/dashboard`, `/hr/dashboard/alerts`, `/hr/dashboard/roster/export`
- **Extension Points:** **attendance analytics extends this** (+ reporting)
- **Forbidden Duplications:** no separate analytics abstraction

### C10 · Reporting / Export
- **Canonical Owner:** `apps/api/src/reporting` (`ExportService`, `ReportTable`)
- **Public API:** `ExportService.render(ReportTable, csv|xlsx|pdf)`
- **Extension Points:** new `ReportTable` producers
- **Forbidden Duplications:** never hand-roll CSV/xlsx/pdf

### C11 · Tenant Infra / RLS / Audit
- **Canonical Owner:** `apps/api/src/common` (`TenantRepository`), `prisma/tenant-context.ts`, migrations (RLS)
- **Public API:** `this.run((tx, tenantId) => …)`, `writeAudit(...)`, `TenantContextStore.get()`
- **Extension Points:** every new table enables RLS + `tenant_isolation` + grants `munaxa_app`
- **Forbidden Duplications:** no table without RLS; no direct Prisma outside `TenantRepository`

### C12 · Self-Service / Manager Portal
- **Canonical Owner:** `apps/api/src/people/self-service`
- **Public API:** `me/hr/*`, `me/team/*`
- **Extension Points:** delegates to C6/C7/C8/Perf/Training/Asset — add delegations only
- **Forbidden Duplications:** no business logic here (delegation + actor→employee resolution only)

### C13 · Transport
- **Canonical Owner:** models in `prisma/schema.prisma` (`BusRoute`, `Bus`, `BusStop`, `BusAttendanceEvent`); driver profile in `people/employee-records/driver.*`
- **AR:** `Bus` / `BusRoute`; `DriverProfile` (bridged to `Employee`)
- **Extension Points:** **event subscriber** for driver duty status (PR-7)
- **Forbidden Duplications:** driver is an `Employee`; no duplicate driver identity

### C14 · Employee (HR aggregate root)
- **Canonical Owner:** `apps/api/src/people/employees` (`EmployeeService`)
- **DB Owner:** `Employee`
- **AR:** `Employee` (lifecycle state machine in `employee-lifecycle.logic.ts`)
- **Public API:** `/employees*`; `EmployeeService` exported for recruitment hire
- **Extension Points:** shift assignment, attendance, all HR child records hang here
- **Forbidden Duplications:** one employee identity; teacher/driver are bridges, not copies

---

## Part B — New capabilities in this program (extension proven impossible)

Each row states **why extension of an existing owner is impossible** (Evolution
Order Step 4). All others in the program are extensions of Part A owners.

### N1 · Shift / Work Schedule
- **Owner (new):** HR — `people/attendance/shift` (or `people/shift`)
- **AR:** `Shift`; assignment `EmployeeShiftAssignment` (→ `Employee`)
- **Why new:** repository-wide search for shift/roster/duty/work-schedule = **0 hits**. No existing owner models expected check-in/out, grace, breaks, overtime window. Attendance stores *observations*, not *expectations*.
- **Events Published:** none (read by policy/record derivation)
- **Consumers:** C6 `record()` (derive late/early/overtime), analytics
- **Extension Points:** shift types, per-campus/role/teacher/driver assignment
- **Forbidden Duplications:** thresholds live in policy (N2), not duplicated on shift

### N2 · Attendance Policy
- **Owner (new, convention-following):** HR — `people/attendance/policy`
- **AR:** `AttendancePolicy` config (per tenant/campus)
- **Why new:** thresholds are currently embedded (DTO `@Max`, `payroll-prep.logic` constants). No data-driven policy owner exists. Follows the established `BillingPolicy`/`TimetableConfig`/`allocation-policy.ts` **convention** (config row + pure `*.logic.ts`), NOT a generic rules engine (none exists; inventing one = competing abstraction).
- **Consumers:** C6 record derivation, C7 payroll, C9 analytics
- **Forbidden Duplications:** one policy source; default policy == current constants (zero behavior change)

### N3 · Attendance Lock
- **Owner (new):** HR — `people/attendance/lock`
- **AR:** `AttendanceLock` (scope DAY/WEEK/PAYROLL/SEMESTER)
- **Why new:** `grep model .*Lock` = 0 (only `BillingPolicy`). No immutability/lock concept exists. Required for payroll integrity + auditable history.
- **Events Published:** `AttendanceLocked/Unlocked`
- **Consumers:** C6 write-guard, C7 validated payroll
- **Forbidden Duplications:** the guard reuses C6 `record()`; no parallel write path

### N4 · Attendance Correction Request
- **Owner (new, pattern-reusing):** HR — `people/attendance/correction`
- **AR:** `AttendanceCorrectionRequest` (+ evidence)
- **Why new:** existing trail is single-level in-place; enterprise workflow (request→manager→HR→apply, evidence, versioned) has no owner. **Reuses the leave `decide()` approval pattern** (per-context approval is the repo convention) — no generic workflow engine.
- **Events Published:** `AttendanceCorrectionRequested/Approved/Rejected`
- **Consumers:** applies via C6 `record()`, respects N3 locks
- **Forbidden Duplications:** keeps existing `correctedFromStatus/By/At` trail; applies through C6

### N5 · Biometric Provider (abstraction only)
- **Owner (new interface):** HR — `people/attendance/biometric`
- **AR:** none (adapter layer); optional `BiometricRawPunch` log
- **Why new:** `StaffAttendanceSource` enum anticipates it but there is no provider port/registry. Abstraction prevents vendor lock-in.
- **Consumers:** normalizes device punches → C6 `record()` (idempotent)
- **Forbidden Duplications:** no second ingestion path; all punches land through C6

---

## Part C — Ownership conflict resolutions (resolved BEFORE implementation)

| Potential conflict | Resolution |
|--------------------|-----------|
| "Academic calendar" holidays | **C3 scheduling** owns date-type; HR consumes via a port. No HR calendar model. |
| Teacher attendance written by HR | **C5 Academics** owns the write; HR only emits an event; sync *projects* into `TeacherAttendance`. |
| Overtime/late thresholds | **N2 policy** owns values; **N1 shift** owns expected windows; **C6** derives; **C7** consumes. |
| Working-day/weekend math | **C8** `workingDaysBetween` is the one helper; becomes calendar-aware via C3 port. No fork. |
| Notifications for attendance | **C2** owns delivery; producers only add catalog entries + emit. |
| Approval workflow | Per-context pattern (C8 leave); N4 **reuses the pattern**, no shared engine. |
| Analytics | **C9 + C10**; no new analytics module. |

---

## Part D — Program completion status

All 15 PRs of the Attendance evolution program have landed on
`claude/attendance-structure-ui-docs-lxo7qc`. Ownership is unchanged from the
plan; the final repository-wide duplicate-detection audit
(see `IMPLEMENTATION_PROGRESS.md`) confirms:

| Invariant | Result |
|-----------|--------|
| One domain event bus | ✅ `events/domain-events.ts` (notifications subscribe) |
| One working-day helper | ✅ `leave/leave-days.logic.ts` |
| One attendance tally | ✅ `payroll-prep.logic.ts` |
| One `HH:MM` parser | ✅ `scheduling-engine.ts` |
| One StaffAttendance write path | ✅ `people/attendance/attendance.repository.ts` |
| One holiday source of truth | ✅ Scheduling `ScheduleException(HOLIDAY)` |
| Approval engines | ✅ per-context (correction reuses the leave pattern) |
| Analytics owner | ✅ HR dashboard + reporting (no new abstraction) |

**New tables introduced (all HR-owned, all justified in Part B):**
`AttendancePolicy`, `Shift`, `EmployeeShiftAssignment`, `AttendanceLock`,
`AttendanceCorrectionRequest`, `AttendanceCorrectionApproval`,
`BiometricRawPunch`.

**Bounded contexts unchanged:** Student ≠ Teacher ≠ Staff attendance remain three
separate stores; staff attendance never left HR; Teacher stayed an Academic
aggregate reached through the existing `Employee.teacher` bridge; students have
no HR relationship.

---

_This matrix is updated as each PR lands. A change that would give a capability a
second owner is a defect and must be redesigned._
