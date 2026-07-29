# HR Structure & UI — Staff, Teachers, and Bus Drivers

This document describes the **Human Resources (HR) structure** in Munaxa as it
exists in the codebase today: the data models, the API surface, the admin UI, and
the specific way **teachers** and **bus drivers** relate to the HR (staff)
directory.

> Scope note: This is a documentation-only artifact. No application code, schema,
> or configuration is changed by this file.

---

## 1. Big picture

HR in Munaxa is not (yet) a dedicated payroll/contracts module — it is a **staff
directory** that unifies two separately-stored people types plus a link into the
Fleet module for drivers:

```
                          ┌─────────────────────────────────────────┐
                          │            HR / Staff Directory          │
                          │        (/people/employees — "HR")        │
                          └─────────────────────────────────────────┘
                                     ▲                    ▲
                merged into one list │                    │ merged into one list
                                     │                    │
              ┌──────────────────────┴───┐      ┌─────────┴───────────────────┐
              │        Teacher           │      │        Employee             │
              │  model Teacher           │      │  model Employee             │
              │  /people/teachers        │      │  (general staff)            │
              │  perm: teacher:manage    │      │  perm: employee:manage      │
              └──────────────────────────┘      └─────────────────────────────┘
                                                          │
                             active employees' names feed │ (driver picker)
                                                          ▼
                                            ┌─────────────────────────────┐
                                            │   Bus.driverName / .Phone   │
                                            │   Fleet ▸ Setup ▸ Buses     │
                                            │   perm: bus:manage          │
                                            └─────────────────────────────┘
```

Key facts:

- **Teachers** and **Employees** are stored in **two separate tables** but are
  **shown together** in one "HR" staff directory page.
- **Bus drivers are not a first-class HR entity.** A bus stores a driver as two
  plain string fields (`driverName`, `driverPhone`). The bus-editing UI offers a
  **dropdown populated from the active `Employee` records** so drivers can be
  chosen from HR, with a "＋ Enter manually…" fallback for ad-hoc / contractor
  drivers not in the staff table.

---

## 2. Data models (`prisma/schema.prisma`)

### 2.1 `Teacher`

Teaching staff, with academic relationships (sections, scheduled classes,
attendance, PTM slots).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `tenantId` | uuid | Multi-tenant scope |
| `userId` | uuid? | Optional linked login account (`@unique`) |
| `employeeNumber` | String? | Unique per tenant (`@@unique([tenantId, employeeNumber])`) |
| `firstNameEn` / `lastNameEn` | String | English name |
| `firstNameAr` / `lastNameAr` | String | Arabic name |
| `specialization` | String? | Subject / specialization |
| `status` | `EmploymentStatus` | `ACTIVE` (default) |
| `createdAt` / `updatedAt` / `deletedAt` | timestamps | Soft-delete via `deletedAt` |

Relations: `sections` (`TeacherSection`), `scheduledClasses`,
`exceptionReplacements` / `exceptionSubstitutions` (`ScheduleException`),
`attendance` (`TeacherAttendance`), `ptmSlots`.

### 2.2 `Employee` (general staff)

Non-teaching staff — the "HR" table. Deliberately lightweight today.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `tenantId` | uuid | Multi-tenant scope |
| `userId` | uuid? | Optional linked login account (`@unique`) |
| `firstNameEn` / `lastNameEn` | String | English name |
| `firstNameAr` / `lastNameAr` | String | Arabic name |
| `jobTitle` | String | Required |
| `department` | String? | Optional |
| `status` | `EmploymentStatus` | `ACTIVE` (default) |
| `createdAt` / `updatedAt` / `deletedAt` | timestamps | Soft-delete via `deletedAt` |

### 2.3 `EmploymentStatus` enum

Shared by both `Teacher` and `Employee`:

```
ACTIVE | ON_LEAVE | TERMINATED
```

### 2.4 `TeacherAttendance`

Daily attendance for teaching staff (distinct from student attendance).

| Field | Type | Notes |
|---|---|---|
| `teacherId` | uuid | FK → Teacher |
| `date` | Date | One row per teacher per day (`@@unique([tenantId, teacherId, date])`) |
| `status` | `TeacherAttendanceStatus` | enum |
| `checkInAt` | timestamptz? | Optional check-in time |
| `note` | String? | |
| `markedById` | uuid? | User who recorded it |

### 2.5 Driver storage — `Bus` (Fleet)

Drivers live **on the bus**, not in a driver table:

| Field | Type | Notes |
|---|---|---|
| `plateNumber` | String | Unique per tenant |
| `label` | String? | "Bus number" in the UI |
| `capacity` | Int? | |
| `routeId` | uuid? | Assigned route |
| `tripRound` | Int? | 1 (first trip) or 2 (second trip) |
| `driverName` | String? | **Driver — free text, seeded from HR** |
| `driverPhone` | String? | **Driver mobile** |
| `lastLat` / `lastLng` / `lastSeenAt` | | Live tracking |

> Design consequence: a driver's identity is duplicated as a string per bus. HR
> is the *source list* for the picker, but there is no referential link back to
> the `Employee` row once selected.

---

## 3. API surface (NestJS — `apps/api/src`)

### 3.1 Teachers — `people/teachers`

`@Controller({ path: 'teachers', version: '1' })`, guarded by
`Permission.TEACHER_MANAGE`.

| Method | Route | Purpose |
|---|---|---|
| POST | `/v1/teachers` | Create teacher |
| GET | `/v1/teachers` | List teachers |
| GET | `/v1/teachers/:id` | Get one |
| PATCH | `/v1/teachers/:id` | Update |
| DELETE | `/v1/teachers/:id` | Soft-delete (204) |
| POST | `/v1/teachers/:id/sections` | Assign to a section (optional subject) |
| GET | `/v1/teachers/:id/sections` | List section assignments |
| DELETE | `/v1/teachers/:id/sections/:assignmentId` | Unassign (204) |

### 3.2 Employees — `people/employees`

`@Controller({ path: 'employees', version: '1' })`, guarded by
`Permission.EMPLOYEE_MANAGE`.

| Method | Route | Purpose |
|---|---|---|
| POST | `/v1/employees` | Create employee |
| GET | `/v1/employees` | List employees |
| GET | `/v1/employees/:id` | Get one |
| PATCH | `/v1/employees/:id` | Update |
| DELETE | `/v1/employees/:id` | Soft-delete (204) |

### 3.3 Buses / drivers — `advanced/bus`

The Fleet module (`bus.controller.ts`, `bus.service.ts`, `area.controller.ts`)
exposes route/bus/area CRUD. Driver data rides along on the bus payload
(`driverName`, `driverPhone`) — there is no separate driver endpoint. Reads use
`bus:read`; mutations use `bus:manage`.

### 3.4 Frontend API client — `apps/admin/src/lib/people.ts`

- `teachersApi` → `list()`, `create()`, `remove()`
- `employeesApi` → `list()`, `create()`, `update()`, `remove()`
- Shared types: `Teacher`, `Employee`, `EmploymentStatus`,
  `EMPLOYMENT_STATUSES = ['ACTIVE', 'ON_LEAVE', 'TERMINATED']`

---

## 4. Admin UI structure

### 4.1 Navigation (`apps/admin/src/components/app-shell.tsx`)

| Section | Item | Route | Permission | Label key |
|---|---|---|---|---|
| People | Teachers | `/people/teachers` | `teacher:manage` | `nav.teachers` |
| People | **HR** | `/people/employees` | `employee:manage` | `nav.hr` |
| People | Students / Parents / Cards | `/people/*` | various | — |
| Operations | **Fleet** | `/fleet` | `bus:read` (flag `bus_tracking`) | `nav.fleet` |

Note the label mapping: the nav item **"HR"** points at
`/people/employees`, and the page title there is `t('nav.hr')`.

### 4.2 HR page — `/people/employees` (the unified staff directory)

File: `apps/admin/src/app/(app)/people/employees/page.tsx`

Layout, top → bottom:

1. **Title** — "HR" (`nav.hr`).
2. **KPI row** (4 tiles): total staff, teachers count, employees count, active
   count (active tinted `text-aqua`).
3. **"Add employee" card** — inline create form (EN + AR names, job title,
   department, status). Hint text notes teachers are added on the Teachers tab.
4. **Filters** — free-text search (matches EN name, AR name, or role) + a
   **Type** filter (`all` / `teacher` / `employee`).
5. **Unified table** — columns: Name · Arabic name · Type · Role · Status ·
   Actions.
   - **Teacher rows**: name is a button opening the read-only
     `TeacherProfileDialog`; role = `specialization`; the Actions cell just
     points back to the Teachers tab (teachers are managed there).
   - **Employee rows**: name opens `EmployeeProfileDialog`; role =
     `jobTitle · department`; Actions = **Edit** (modal editor) + **Delete**.

The merge is explicit in `load()`:

```ts
// Teachers and general employees are stored separately, but staff want to see
// them in one directory — merge both here. Teachers stay managed (assignments)
// on the Teachers tab.
const [emps, tchs] = await Promise.all([
  employeesApi.list(),
  teachersApi.list().catch(() => [] as Teacher[]),
]);
```

### 4.3 Teachers page — `/people/teachers`

File: `apps/admin/src/app/(app)/people/teachers/page.tsx`

- Title "Teachers".
- **"Add teacher" card** — create form: EN names, AR names, employee number,
  specialization, status.
- **Table** — Name · Arabic name · Employee # · Specialization · Status ·
  Actions (Delete). Empty state when none.
- Section assignment (via the API's `:id/sections` endpoints) is the teacher's
  academic link into timetable/attendance.

### 4.4 Profile dialogs

- `teacher-profile-dialog.tsx` — read-only modal: `RecordHeader` with initials,
  EN title, AR subtitle, `EmploymentStatusBadge`, a "Teacher" badge, and the
  specialization badge. Tabbed (overview + placeholders).
- `employee-profile-dialog.tsx` — mirrors the teacher dialog: header with job
  title + department badges, tabs, and a **placeholder** marking the richer HR
  data (payroll, contracts, leave, documents) that a full HR module would add
  later. Has an **Edit** action.

### 4.5 Employee editor (modal)

Inside `employees/page.tsx` — `EmployeeEditor`: EN/AR names, job title,
department, status; PATCHes via `employeesApi.update`, toasts on success.

---

## 5. Drivers ↔ HR ↔ Fleet: the connection in detail

File: `apps/admin/src/app/(app)/fleet/setup.tsx` → `BusesCard`

This is where HR and Fleet meet. When registering or editing a bus:

1. On mount, the card fetches **active employees** from HR:

   ```ts
   employeesApi.list().then(setEmployees).catch(() => setEmployees([]));
   ```

2. It derives a **driver name list** from active staff:

   ```ts
   const driverNames = employees
     .filter((e) => e.status === 'ACTIVE')
     .map((e) => `${e.firstNameEn} ${e.lastNameEn}`.trim())
     .filter(Boolean);
   const hrAvailable = driverNames.length > 0;
   ```

3. The **Driver field** renders as:
   - a **`<Select>` of HR staff names** when `hrAvailable && !manualDriver`,
     with a trailing option `＋ Enter manually…` (`MANUAL_DRIVER = '__manual__'`)
     that flips to a free-text `<Input>`, **or**
   - a plain **text `<Input>`** when there are no active employees, or when the
     user chose manual entry (e.g. an outsourced/contract driver).

4. **Driver mobile** is always a free-text input (`driverPhone`).

5. On save, the chosen/typed `driverName` + `driverPhone` are written onto the
   **`Bus`** record (`busApi.createBus` / `busApi.updateBus`). Editing a bus
   whose driver isn't in the staff list auto-enables manual mode:

   ```ts
   setManualDriver(Boolean(b.driverName) && !driverNames.includes(b.driverName ?? ''));
   ```

In the **Buses table**, each bus shows its plate with the driver name and phone
as a sub-line (`{b.driverName} · {b.driverPhone}`).

### Why it's modeled this way

| Aspect | Teacher | Employee (HR) | Bus driver |
|---|---|---|---|
| Own table | ✅ `Teacher` | ✅ `Employee` | ❌ (string on `Bus`) |
| In HR directory | ✅ (merged) | ✅ (native) | ❌ (only via being an Employee) |
| Managed where | `/people/teachers` | `/people/employees` | `/fleet` (Setup ▸ Buses) |
| Permission | `teacher:manage` | `employee:manage` | `bus:manage` |
| Referential link | to sections/schedule | — | none (denormalized name) |

The upshot: **to make a driver appear in the picker, add them as an `Employee`
(HR) with status `ACTIVE`.** Otherwise, enter the driver by hand on the bus.

---

## 6. Roles & permissions summary

| Capability | Permission | Enforced at |
|---|---|---|
| Manage teachers (+ section assignment) | `teacher:manage` | `TeacherController` |
| Manage employees / HR staff | `employee:manage` | `EmployeeController` |
| Read fleet (routes, buses, drivers) | `bus:read` | Fleet read endpoints |
| Manage fleet (assign/register buses & drivers) | `bus:manage` | Fleet mutation endpoints |

---

## 7. Notable gaps / "later" markers in code

- `EmployeeProfileDialog` explicitly documents that **payroll, contracts, leave,
  and documents** are placeholders for a future full HR module.
- Drivers have **no dedicated model, licensing, or document tracking** — only a
  name + phone string on the bus.
- No referential integrity between a bus's `driverName` and the `Employee` it
  was picked from; renaming/terminating the employee does not propagate to buses.

---

## 8. File index

| Concern | Path |
|---|---|
| Schema (Teacher, Employee, Bus, TeacherAttendance) | `prisma/schema.prisma` |
| Teachers API | `apps/api/src/people/teachers/` |
| Employees API | `apps/api/src/people/employees/` |
| Fleet / bus API | `apps/api/src/advanced/bus/` |
| Frontend API client + types | `apps/admin/src/lib/people.ts` |
| HR (staff directory) page | `apps/admin/src/app/(app)/people/employees/page.tsx` |
| Employee profile dialog | `apps/admin/src/app/(app)/people/employees/employee-profile-dialog.tsx` |
| Teachers page | `apps/admin/src/app/(app)/people/teachers/page.tsx` |
| Teacher profile dialog | `apps/admin/src/app/(app)/people/teachers/teacher-profile-dialog.tsx` |
| Fleet setup (driver picker) | `apps/admin/src/app/(app)/fleet/setup.tsx` |
| Navigation | `apps/admin/src/components/app-shell.tsx` |
