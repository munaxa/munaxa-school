# Attendance — Structure & UI

_Munaxa Phase 7 (Attendance System) + HR Phase 5 (Staff Attendance & Payroll).
Snapshot of the data model, API surface, offline-sync engine, and the
Admin/Mobile UI, reconstructed from the live source tree. Documentation only —
no code changes._

---

## 1. Overview

Attendance in Munaxa spans **three distinct subsystems**, each with its own
tables, controllers and UI:

| Subsystem | Who | Backend | Purpose |
|-----------|-----|---------|---------|
| **Student attendance** | Students, per section/day/class | `apps/api/src/attendance/students` | Idempotent, offline-first marking (manual + QR); dashboard summary; parent/student history. |
| **Teacher attendance** | Teachers, per day | `apps/api/src/attendance/teachers` | Daily present/absent/late/on-leave marking. |
| **Staff (HR) attendance** | Employees, per day | `apps/api/src/people/attendance` | Check-in/out, late/overtime, correction trail, and **payroll preparation** (with CSV/xlsx/pdf export). |

A fourth concern — **how** student attendance is captured (teacher roster vs.
gate vs. bus) — is a per-tenant **settings** toggle served by the presence
module (`/attendance/settings`).

```
Student marking ─ offline queue ─► POST /attendance/students/bulk (idempotent) ─► StudentAttendance
QR scan ─────────────────────────► POST /attendance/students/qr ───────────────► StudentAttendance
Teacher day ─────────────────────► POST /attendance/teachers ────────────────► TeacherAttendance
HR roster / record ──────────────► POST /hr/attendance/bulk, /employees/:id/attendance ─► StaffAttendance
                                                                         │
                                              GET /hr/payroll-prep ──► summarizeAttendance() ─► export
```

**Source map**

| Area | Location |
|------|----------|
| DB models + RLS (students/teachers) | `prisma/migrations/20260603160000_attendance/migration.sql` |
| DB model + RLS (staff/HR) | `prisma/migrations/20260723160000_hr_staff_attendance/migration.sql` |
| Prisma models | `prisma/schema.prisma` — `StudentAttendance`, `TeacherAttendance`, `StaffAttendance` |
| Student/Teacher backend | `apps/api/src/attendance/{students,teachers}`, `attendance.module.ts` |
| Staff/HR backend | `apps/api/src/people/attendance/*` (`StaffAttendanceModule`) |
| Payroll-prep engine (+ unit tests) | `apps/api/src/people/attendance/payroll-prep.logic.ts` (+ `.spec.ts`, 6 cases) |
| Attendance-source settings | `apps/api/src/presence/presence.controller.ts` (`AttendanceSettingsController`) |
| Permissions | `packages/domain/src/permissions.ts`, `role-permissions.ts` |
| Admin — class marking UI | `apps/admin/src/app/(app)/attendance/page.tsx`, `src/lib/attendance.ts` |
| Admin — settings UI | `apps/admin/src/app/(app)/settings/attendance/page.tsx`, `src/lib/attendance-settings.ts` |
| Admin — employee history/record | `apps/admin/src/app/(app)/people/employees/[employeeId]/tabs/attendance-tab.tsx` |
| Mobile — offline engine | `apps/mobile/lib/data/attendance/*`, `lib/features/attendance/attendance_controller.dart` |
| Mobile — teacher marking screen | `apps/mobile/lib/features/teacher/teacher_class_screen.dart` |
| e2e | `apps/api/test/attendance.e2e-spec.ts` (9), `test/hr-attendance.e2e-spec.ts` (6) |

> **Note on `classNumber`:** the original migration named the per-period column
> `periodIndex`; the current Prisma schema and all application code call it
> **`classNumber`** (`0` = daily/homeroom, `>0` = per-class). The unique key and
> idempotency contract use `classNumber`.

---

## 2. Data model

All tables are tenant-isolated via Row-Level Security (`tenant_isolation`
policy: `tenantId = app_current_tenant() OR app_is_platform()`, both `USING`
and `WITH CHECK`, with `FORCE ROW LEVEL SECURITY`).

### Enums

| Enum | Values |
|------|--------|
| `AttendanceStatus` (student) | `PRESENT, ABSENT, LATE, EXCUSED` |
| `TeacherAttendanceStatus` | `PRESENT, ABSENT, LATE, ON_LEAVE` |
| `AttendanceMethod` | `MANUAL, QR` |
| `StaffAttendanceStatus` | `PRESENT, ABSENT, LATE, EARLY_DEPARTURE, ON_LEAVE, HOLIDAY, REMOTE` |
| `StaffAttendanceSource` | `MANUAL, QR, BIOMETRIC, GPS, MOBILE` |

### `StudentAttendance` — one mark per student/day/class

Unique on `(tenantId, studentId, date, classNumber)` — the idempotency key that
lets an offline queue re-sync without creating duplicates.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `tenantId` | UUID | FK → Tenant (cascade) |
| `studentId` | UUID | FK → Student (cascade) |
| `sectionId` | UUID | FK → Section (cascade) |
| `date` | Date | the marked day |
| `classNumber` | Int | default `0`; `0` = daily/homeroom, `>0` = per-class |
| `status` | AttendanceStatus | |
| `method` | AttendanceMethod | default `MANUAL` |
| `note` | Text? | |
| `markedById` | UUID? | FK → User (set null) |
| `clientRef` | Text? | offline-queue client id (audit/debug only) |
| `recordedAt` / `updatedAt` | Timestamptz | |

Indexes: `(tenantId, sectionId, date)`, `(tenantId, studentId, date)`.

### `TeacherAttendance` — one mark per teacher/day

Unique on `(tenantId, teacherId, date)`.

| Column | Type | Notes |
|--------|------|-------|
| `teacherId` | UUID | FK → Teacher (cascade) |
| `date` | Date | |
| `status` | TeacherAttendanceStatus | |
| `checkInAt` | Timestamptz? | |
| `note` | Text? | |
| `markedById` | UUID? | FK → User (set null) |

### `StaffAttendance` — one row per employee/day (HR)

Unique on `(tenantId, employeeId, date)`. Carries payroll-relevant metrics and a
built-in **correction trail**.

| Column | Type | Notes |
|--------|------|-------|
| `employeeId` | UUID | FK → Employee (cascade) |
| `date` | Date | |
| `status` | StaffAttendanceStatus | |
| `source` | StaffAttendanceSource | default `MANUAL` |
| `checkInAt` / `checkOutAt` | Timestamptz? | |
| `lateMinutes` | Int? | |
| `overtimeHours` | Decimal(5,2)? | |
| `note` | Text? | |
| `correctedFromStatus` | StaffAttendanceStatus? | prior status when a day is corrected |
| `correctedById` | UUID? | FK → User (set null) — who corrected |
| `correctedAt` | Timestamptz? | when corrected |
| `markedById` | UUID? | FK → User (set null) |

Indexes: `(tenantId)`, `(tenantId, date)`, `(tenantId, employeeId)`. The
migration also `GRANT`s CRUD to the `munaxa_app` runtime role.

---

## 3. Backend engines

### 3.1 Idempotent student marking (`StudentAttendanceService`)

- **`bulkMark`** — validates the section exists in-tenant, resolves the actor
  from `TenantContextStore`, and upserts every record in **one transaction**
  keyed on `(tenant, student, date, classNumber)`. Re-sending the same batch
  updates rather than duplicates → safe offline replay. Returns `{ marked }`.
- **`markByQr`** — resolves a student by `qrCode` (must be assigned to a
  section), upserts a `method: QR` mark (default status `PRESENT`).
- **`summary`** — tallies a section/date/class into
  `counts: { PRESENT, ABSENT, LATE, EXCUSED }` + `total`.
- **`studentHistory`** — a student's marks over an optional `[from, to]`
  window (parent/student view).
- **`currentClass`** — delegates to `SchedulingService.getCurrentSectionClass`:
  the class attendance is being taken for is *resolved from the published
  timetable*, not asked of the marker.

Dates are normalised to **UTC midnight** (`toDate`) to match `@db.Date`.

### 3.2 Staff attendance + payroll prep (`AttendanceService`)

- **`record`** / **`bulk`** — upsert on `(employee, date)`. When an existing
  row's status changes, the previous status is captured into
  `correctedFromStatus / correctedById / correctedAt`, and every write emits an
  audit entry (`staff_attendance.record | .correct | .bulk`).
- **`payrollPrep`** — the aggregation entry point. In parallel it loads active
  employees, attendance rows in range, and approved leave in range, then per
  employee calls the pure `summarizeAttendance`.

**`payroll-prep.logic.ts`** (pure, DB-free, unit-tested):

```
summarizeAttendance(workingDays, days[], leave):
  PRESENT | LATE | EARLY_DEPARTURE → presentDays++
  REMOTE                           → remoteDays++
  ABSENT                           → absentDays++
  LATE                             → lateDays++;  sum lateMinutes / overtimeHours
  ON_LEAVE / HOLIDAY               → accounted via leave allocation / calendar
  payableDays = max(0, workingDays − absentDays − unpaidLeaveDays)

overlapWorkingDays(range, leave) = workingDaysBetween(intersection)   # Fri/Sat excluded
```

Money is intentionally **not** computed — this is *preparation*: it produces the
day counts a payroll officer exports and feeds into the payroll run. Overtime is
`round2`-ed to avoid float drift. `toReportTable` renders the result into a
generic `ReportTable` for CSV/xlsx/pdf export via `ExportService`.

---

## 4. API — `/api/v1`

### Student attendance — `/attendance/students`

| Method | Path | Permission |
|--------|------|------------|
| POST | `/attendance/students/bulk` (200) | `attendance:create` |
| POST | `/attendance/students/qr` (200) | `attendance:create` |
| GET | `/attendance/students?sectionId=&date=&classNumber=` | `attendance:read` |
| GET | `/attendance/students/summary?sectionId=&date=&classNumber=` | `attendance:read` |
| GET | `/attendance/students/current-class?sectionId=` | `attendance:read` |
| GET | `/attendance/students/:studentId/history?from=&to=` | `attendance:read` |

### Teacher attendance — `/attendance/teachers`

| Method | Path | Permission |
|--------|------|------------|
| POST | `/attendance/teachers` (200) | `attendance:create` |
| GET | `/attendance/teachers?date=` | `attendance:read` |

### Staff / HR — `/hr` and `/employees/:employeeId/attendance`

| Method | Path | Permission |
|--------|------|------------|
| GET | `/hr/attendance?date=` (daily roster) | `staff-attendance:read` |
| POST | `/hr/attendance/bulk` | `staff-attendance:manage` |
| GET | `/hr/payroll-prep?from=&to=&format=` (`csv\|xlsx\|pdf`) | `payroll:prepare` |
| GET | `/employees/:id/attendance?from=&to=` | `staff-attendance:read` |
| POST | `/employees/:id/attendance` (record/correct) | `staff-attendance:manage` |

### Attendance source settings — `/attendance/settings`

| Method | Path | Permission |
|--------|------|------------|
| GET | `/attendance/settings` | `attendance:read` |
| PUT | `/attendance/settings` | `attendance:configure` |

**Permissions** (`packages/domain`): `attendance:create`, `attendance:read`,
`attendance:export`, `attendance:configure`; `staff-attendance:read`,
`staff-attendance:manage`, `payroll:prepare`. Roles wire these in
`role-permissions.ts` (e.g. Teacher → create/read; HR → staff-attendance +
payroll; Parent/Student → read).

---

## 5. Offline-first mobile engine

`apps/mobile/lib/data/attendance` + `features/attendance/attendance_controller.dart`.

```
mark()/markMany() ─► AttendanceQueue.enqueue (secure-storage WAL, de-duped on
                     section:date:classNumber:student) ─► sync()
sync() ─► group pending by (section|date|classNumber) ─► POST /bulk per batch
       ─► on success removeByRefs();  on failure stay queued (retry later)
connectivity change (online) ─► auto-drain queue
```

- **`AttendanceQueue`** — a durable write-ahead queue persisted as a JSON list
  in `FlutterSecureStorage` (survives app restarts, no codegen DB). Enqueue
  de-dupes locally on the idempotency key.
- **`AttendanceController`** (Riverpod `Notifier<int>` exposing the pending
  count) — writes locally first (optimistic/offline), then tries to sync; a
  `connectivity_plus` listener drains automatically when the network returns.
- **`AttendanceApi.syncBatch`** posts one `(sectionId, date, classNumber)`
  batch to `/attendance/students/bulk`; server idempotency makes replays safe.
  `markByQr` posts to `/attendance/students/qr`.

---

## 6. UI

### 6.1 Admin — Class attendance marking (`/attendance`)
`apps/admin/src/app/(app)/attendance/page.tsx`

A single-section roster marker.

**Controls** — Section picker (`EntityPicker`, searchable), Date input, Period
`Select` (1–8), **Load roster** button (fetches students + any existing marks in
parallel via `attendanceApi.list`).

**Roster table** — one row per student (English name + Arabic subline, RTL). The
status is a 4-button segmented control **P / L / A / E** with tone-coded active
state:

| Status | Tone class |
|--------|-----------|
| `PRESENT` | `bg-aqua` |
| `LATE` | `bg-coral` |
| `ABSENT` | `bg-destructive` |
| `EXCUSED` | `bg-primary` |

**Header** shows live count badges (present / late / absent / excused +
`marked/total`), a **Mark all present** shortcut, and **Save attendance**
(`attendanceApi.mark` → `/bulk`). All strings i18n (`useI18n`); errors via toast.

```
┌───────────────────────────────────────────────────────────┐
│  Attendance                                               │
│  [ Section ▾ ]  [ Date 📅 ]  [ Period ▾ ]  [ Load roster ]│
│  ✔3 present  ⚠1 late  ✖0 absent  •0 excused   4/28 marked │
│                              [ Mark all present ] [ Save ] │
│ ┌───────────────────────────┬──────────────────────────┐  │
│ │ Student                   │           Status         │  │
│ ├───────────────────────────┼──────────────────────────┤  │
│ │ Layla Ahmad / ليلى أحمد   │      [P][L][A][E]        │  │
│ │ Omar Nasser / عمر ناصر    │      [P][L][A][E]        │  │
│ └───────────────────────────┴──────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

### 6.2 Admin — Attendance settings (`/settings/attendance`)
`apps/admin/src/app/(app)/settings/attendance/page.tsx`

Per-tenant source configuration (auto-saves on change).

- **Source mode** `Select` — `TEACHER_ONLY | GATE_ARRIVAL | BUS_ARRIVAL |
  HYBRID`, each with a help line.
- **Modules** — Presence tracking on/off, Transport tracking on/off, and Bus
  method (`NFC | RFID | QR | MANUAL`).

Backed by `attendanceSettingsApi` → `/attendance/settings` (served by the
presence module).

### 6.3 Admin — Employee attendance tab (HR)
`.../people/employees/[employeeId]/tabs/attendance-tab.tsx`

Two cards on an employee profile:

- **Record attendance** (only when `canManage`) — Date, Status
  (`STAFF_ATTENDANCE_STATUSES`), Late minutes, Overtime hours, Note → save via
  `attendanceApi.record`.
- **Attendance history** — table of date / status badge / late / overtime /
  note. A corrected day shows `(corrected from <status>)`. Status tones:
  PRESENT/REMOTE → success, LATE/EARLY_DEPARTURE → warning, ABSENT → danger,
  ON_LEAVE/HOLIDAY → muted.

### 6.4 Mobile — Teacher class marking
`apps/mobile/lib/features/teacher/teacher_class_screen.dart`

Statuses `['PRESENT','LATE','ABSENT','EXCUSED']` shown as `P/L/A/E` chips per
student, a **Mark all present** action, and a **Save** that calls
`attendanceControllerProvider.markMany(...)` (whole roster → one queued batch).
A pending-count badge and manual **sync** button surface unsynced marks. Student
home / parent portal / dashboards also read attendance for at-a-glance widgets.

---

## 7. Verified behavior (tests)

- **Unit — payroll-prep logic (6):** present/late/early-departure vs. remote vs.
  absent tallies, late-minute & overtime summation, paid/unpaid leave overlap,
  `payableDays` clamping, and range-intersection working-day counting.
- **e2e — student/teacher attendance (9):** bulk mark; idempotent re-sync (no
  duplicates, applies updates); QR scan; dashboard summary; student history
  (parent/student view); idempotent teacher marking; RBAC (Student role cannot
  mark; Teacher may list sections + a class roster).
- **e2e — HR staff attendance & payroll (6):** record + correction-trail
  capture on status change; range-filtered employee history; bulk daily roster;
  payroll-prep aggregation across attendance and approved paid leave; CSV
  export; RBAC enforcement.

---

## 8. Notes / limitations

- The current class is **timetable-resolved** (`current-class` endpoint), so
  markers never pick the period manually where the schedule is published.
- Dates are stored as `@db.Date` and normalised to UTC midnight throughout;
  there is no per-period timezone handling.
- Student, teacher, and staff attendance are **three separate stores** — there
  is no unified cross-role attendance view; each has its own permission set.
- Payroll-prep stops at day counts; monetary computation is deliberately
  deferred to the payroll run that consumes the export.
