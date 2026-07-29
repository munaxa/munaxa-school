# HR — Module Structure & Connections

_Munaxa HR domain (People), reconstructed from the live source tree
(`apps/api/src/people/**`, `prisma/schema.prisma`, `apps/admin/.../people`).
Companion to `ATTENDANCE_STRUCTURE_UI.md` — this one focuses on **how the HR
modules connect**. Documentation only — no code changes._

---

## 1. The big picture

HR is a cluster of NestJS modules under `apps/api/src/people`, all registered in
`app.module.ts`. **`Employee` is the hub**: almost every HR table is a child of
`Employee`, and every module keys its work on an `employeeId`.

```
                         ┌───────────────────────────────────────────┐
                         │              PeopleModule                 │
                         │  Employee · Teacher · Student · Parent ·  │
                         │  Department · Position (org)              │
                         │  exports: EmployeeService, Enrollment…    │
                         └───────────────┬───────────────────────────┘
                                         │ EmployeeService (create/lifecycle)
             ┌───────────────────────────┼───────────────────────────┐
             │                           │                           │
   RecruitmentModule            (child record modules)        Cross-cutting
   imports PeopleModule    EmployeeRecordsModule · LeaveModule   HrDashboardModule
   hire() → EmployeeService  StaffAttendanceModule · Performance  (aggregates all)
                            TrainingModule · AssetModule
                                         │
                                         │ services exported
                                         ▼
                                 SelfServiceModule
                    imports Leave + StaffAttendance + Asset +
                    Performance + Training; resolves actor→employee
                    and delegates (no duplicated business logic)
```

**Two connective hubs, in code:**

1. **`EmployeeService`** — exported by `PeopleModule` and consumed by
   `RecruitmentModule` to turn a hired applicant into a real `Employee`.
2. **`SelfServiceModule`** — imports the five employee-facing modules and
   re-exposes them under `me/*` for the employee & manager portals, delegating
   to the canonical services rather than re-implementing logic.

---

## 2. Module registration (`app.module.ts`)

| Module | Route prefix(es) | Exports (reused by) |
|--------|------------------|---------------------|
| `PeopleModule` | `employees`, `teachers`, `students`, `parents`, `hr/departments`, `hr/positions` | `EmployeeService`, `EnrollmentLifecycleService` |
| `EmployeeRecordsModule` | `employees/:id/{contracts,documents,emergency-contacts,dependents,education,certificates,bank-accounts,driver-profile}`, `drivers` | — |
| `LeaveModule` | `hr/leave-*`, `employees/:id/leave*` | `LeaveService` (self-service) |
| `StaffAttendanceModule` | `hr/attendance`, `hr/payroll-prep`, `employees/:id/attendance` | `AttendanceService` (self-service) |
| `PerformanceModule` | `hr/*` (cycles/reviews/goals), `employees/:id/*` | `PerformanceService` (self-service) |
| `TrainingModule` | `hr/*`, `employees/:id/training-records` | `TrainingService` (self-service) |
| `AssetModule` | `hr/assets`, `employees/:id/assets` | `AssetService` (self-service) |
| `RecruitmentModule` | `hr/*` (postings/applicants/interviews) | — (imports `PeopleModule`) |
| `SelfServiceModule` | `me/hr`, `me/team` | — (imports Leave/Attendance/Asset/Performance/Training) |
| `HrDashboardModule` | `hr/dashboard` | — (imports `ReportingModule`) |

**Route convention** — every HR module double-exposes:
- an **admin/HR-officer surface** under `hr/...` (or the resource root), and
- an **employee-scoped surface** under `employees/:employeeId/...`.

The self-service portal adds a **third** surface, `me/hr` (own data) and
`me/team` (a manager's direct reports).

---

## 3. The hub: `Employee` model & its relations

`Employee` (in `prisma/schema.prisma`) is a tenant-isolated aggregate root.
Every HR sub-record hangs off it. Its outgoing relations _are_ the connection map:

| Group | Fields / relations |
|-------|--------------------|
| Identity | names (En/Ar), nationalId, passport, visa, gender, DOB, marital status, photo |
| Employment | `jobTitle`, `employmentType`, **`status: EmploymentStatus`**, hireDate, probationEndDate, terminationDate |
| Org placement | `campusId`, `departmentId`, `positionId`, **`managerId`** (self-reference → org chart / `reports`) |
| Account link | `userId?` (→ `User`, unique) — how self-service resolves the actor |
| Records (1-N) | `contracts`, `documents`, `emergencyContacts`, `dependents`, `education`, `certificates`, `bankAccounts`, `driverProfile` |
| HR ops (1-N) | `leaveBalances`, `leaveRequests`, **`attendance` (StaffAttendance)**, `performanceReviews`, `performanceGoals`, `trainingRecords`, `assetAssignments` |
| Lifecycle | `statusHistory` (EmployeeStatusHistory) |
| Bridges | `teacher` (Employee↔Teacher), `busesDriven`/`driverProfile` (transport), `hiredFromApplicant` (recruitment) |

Keys: unique `(tenantId, employeeNumber)`; indexed on `(tenantId)`,
`(tenantId, status)`. Soft-deleted via `deletedAt`.

---

## 4. Key connections (the wiring that matters)

### 4.1 Recruitment → Employee (hire bridge)
`recruitment.service.ts` → `EmployeeService.create`

`RecruitmentModule` **imports `PeopleModule`** so it can call
`EmployeeService`. `hire(applicantId, dto)`:
1. loads the applicant + its posting,
2. builds a `CreateEmployeeDto` (English names from the applicant; Arabic names +
   job details from the DTO, defaulting `jobTitle`/dept/position/type from the
   posting),
3. creates a real `Employee` at status **`HIRED`**,
4. links the applicant (`markHired` sets `hiredEmployeeId`; a hired applicant is
   then immutable).

This is the single point where the recruitment pipeline crosses into the
employee master.

### 4.2 Employee lifecycle state machine
`employee-lifecycle.logic.ts` (pure, unit-testable, reused by recruitment)

The 16 `EmploymentStatus` values form a directed graph. `create` seeds an
employee at an **entry** status (`CANDIDATE | HIRED | PROBATION | ACTIVE`);
thereafter status only moves along `canTransition`-approved edges, each recorded
in `EmployeeStatusHistory` + `AuditLog`. Entering an **exit** status
(`RETIRED | RESIGNED | TERMINATED`) stamps `terminationDate`; `ARCHIVED` is fully
terminal. The recruitment prefix (`CANDIDATE → INTERVIEW → OFFER_* →
BACKGROUND_CHECK → HIRED`) funnels toward the working statuses.

### 4.3 Leave → Attendance → Payroll (the payroll spine)
`leave-days.logic.ts` ⟶ `leave.service.ts` ⟶ `payroll-prep.logic.ts`

This is the most important cross-module chain, and it is glued by **one shared
pure helper**:

```
workingDaysBetween(start, end)   # leave-days.logic.ts — excludes Fri/Sat weekend
        │
        ├── LeaveService.createRequest → computes a request's workingDays
        │   approve() at final level → deducts StaffLeaveBalance (paid vs unpaid via LeaveType.paid)
        │
        └── AttendanceService.payrollPrep → workingDays for the period
                 + StaffAttendance rows (present/remote/absent/late/overtime)
                 + approvedLeaveInRange (overlapWorkingDays, split paid/unpaid)
                 → summarizeAttendance() → payableDays = workingDays − absent − unpaidLeave
```

- **Leave approval** is multi-level: a request carries `requiredLevels` (from the
  `LeaveType`) and `currentLevel`; each approval advances a level, the **final**
  approval flips status to `APPROVED` and deducts the balance. Cancelling an
  approved request restores the balance.
- **Payroll prep** (`GET /hr/payroll-prep`) then reads those *approved* leave
  spans back out and folds them, together with `StaffAttendance`, into per-
  employee day counts — never money (that's left to the downstream payroll run).
  See `ATTENDANCE_STRUCTURE_UI.md §3.2` for the attendance side.

The Fri/Sat working-week rule lives in exactly one place (`leave-days.logic.ts`)
and both leave and payroll import it — so the two can never disagree.

### 4.4 Self-service / manager portal (delegation hub)
`self-service.service.ts` — imports Leave, Attendance, Asset, Performance, Training

Adds **only** two things over the canonical services: actor→employee resolution
(`TenantContextStore.actorUserId` → `Employee.userId` → `employeeId`) and
ownership authorisation. Then it delegates:

- `me/hr`: `myProfile`, `myLeaveBalances/Requests`, `submitLeave`, `cancelLeave`
  (asserts ownership), `myAttendance`, `myAssets`, `myTraining`, `myReviews`,
  `acknowledgeReview` (asserts ownership).
- `me/team`: `myReports`, `teamPendingLeave`, `approveTeamLeave`/`rejectTeamLeave`
  (asserts the request belongs to a **direct report** via `managerId`).

No leave math, balance deduction, or audit is duplicated here — it all flows back
into `LeaveService` / `AttendanceService` / etc.

### 4.5 HR dashboard (read-only aggregator)
`hr-dashboard.service.ts` — imports `ReportingModule`

Fans out parallel repository queries across the whole domain into one summary:
headcount by status/department, pending leave approvals, open postings & active
applicants, asset totals, active performance cycles & reviews awaiting ack, and a
60-day **expiring-items** feed (documents, contracts, certificates, training,
probation). `alerts(within)` is explicitly the source of truth a scheduled
reminder job would consume; `rosterReport()` exports the headcount via the shared
`ReportTable` → csv/xlsx/pdf pipeline.

### 4.6 Employee ↔ Teacher ↔ Transport
`Employee.teacher` (1-1) links the HR record to the academic `Teacher` (who owns
section assignments and teacher attendance). `Employee.driverProfile` +
`busesDriven` link HR to the transport domain (the Phase-3 driver refactor made
drivers first-class employees). These are the seams where HR meets Academics and
Transport.

---

## 5. Shared infrastructure every HR module rides on

- **Tenant isolation** — all tables carry `tenantId` with RLS
  (`tenant_isolation` policy); repositories extend `TenantRepository` and run
  inside a tenant-scoped transaction (`this.run((tx, tenantId) => …)`).
- **Actor / audit** — `TenantContextStore.actorUserId` stamps `markedById`,
  `createdById`, correction trails, and `AuditLog` writes (e.g.
  `staff_attendance.correct`, employee status transitions).
- **Reporting/export** — `ReportingModule`'s `ExportService.render(ReportTable,
  format)` is the common CSV/xlsx/pdf path (payroll-prep, HR roster).
- **Permissions** (`packages/domain`) — HR-specific:
  `staff-attendance:read|manage`, `payroll:prepare`, plus leave/performance/
  training/asset/recruitment grants; wired to roles in `role-permissions.ts`.

---

## 6. Admin UI map (`apps/admin/src/app/(app)/people`)

| Route | Purpose | Connects to |
|-------|---------|-------------|
| `people/employees` | Employee list + editor | `EmployeeService` CRUD |
| `people/employees/[id]` | Profile shell with **tabs** | one tab per HR module ↓ |
| ↳ tabs | `personal-records`, `contracts`, `documents`, `driver`, **`attendance`**, `leave`, `performance`, `training`, `assets` | each tab → its module's `employees/:id/*` API |
| `people/org` | Departments & positions | org module |
| `people/leave` | Leave types / requests / approvals | `LeaveService` |
| `people/payroll` | Payroll-prep range + export | `GET /hr/payroll-prep` |
| `people/performance` | Cycles & reviews | `PerformanceService` |
| `people/training` | Training catalog & records | `TrainingService` |
| `people/assets` | Asset register & assignments | `AssetService` |
| `people/recruitment` / `[postingId]` | Postings, applicants, hire | `RecruitmentService` → hire bridge |
| `people/hr-dashboard` | KPIs, alerts, expiring items | `HrDashboardService` |
| `people/cards` | Staff ID cards | employee identity data |

The **employee profile page is itself a connection diagram**: each tab is a thin
client over one HR module's `employees/:employeeId/...` endpoints, so the profile
is where all the modules visibly converge on a single `Employee`.

---

## 7. How this connects to attendance (cross-reference)

The staff-attendance subsystem documented in `ATTENDANCE_STRUCTURE_UI.md` is
**one of these HR modules** (`StaffAttendanceModule`, `people/attendance`). Its
connections back into HR:

- **belongs to** `Employee` (`Employee.attendance` → `StaffAttendance`),
- **feeds** payroll prep alongside approved **leave** (shared
  `workingDaysBetween`),
- **is re-exposed** through `me/hr/attendance` by self-service,
- **is surfaced** on the employee profile's Attendance tab and the HR dashboard.

Student and Teacher attendance (the other two subsystems in that doc) live
**outside** the People/HR tree, under `apps/api/src/attendance`, and connect to
the academic `Section`/`Student`/`Teacher` models rather than to `Employee`.
