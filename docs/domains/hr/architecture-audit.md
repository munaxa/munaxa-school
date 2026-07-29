# Munaxa HR Transformation — Architecture Audit (Phase 0)

**Date:** 2026-07-23
**Environment:** `munaxa-staging` (Supabase) — demo/testing data only, no production users.
**Author:** Enterprise Architecture review
**Scope:** Current-state audit of everything the HR/HRMS transformation touches. This is the
mandatory pre-implementation audit. The codebase — **not** the docs — is treated as source of truth.

---

## 0. Executive summary of current state

Munaxa is a **mature, well-structured NestJS + Next.js monorepo** (140 Prisma models, 74
migrations, ~4,800-line schema, multi-tenant with RLS, a real RBAC layer, a generic audit log, and
a design system). It is **not** a greenfield — the transformation must extend a working system, not
rebuild it.

The current "HR" is a **two-table staff directory** (`Teacher` + `Employee`) with a merged UI list.
It has **none** of the enterprise HRMS surface the prompt asks for: no employment lifecycle, no
contracts, no org units (positions/departments), no recruitment, no staff leave, no performance,
no training, no assets, no document management, no self-service/manager portals, no HR dashboard,
no HR reporting, no automation, and drivers are denormalized strings on `Bus`.

**Verdict:** The foundation (auth, RBAC, audit log, tenancy, design system, existing `Campus`
model) is strong and reusable. The HR domain itself is essentially unbuilt beyond CRUD. This is a
**greenfield build on a mature platform**, not a refactor of existing HR logic — which is good news
for architecture, but it means the true scope is a multi-phase program, not a single change.

---

## 1. What exists today (inventory)

### 1.1 Data models (`prisma/schema.prisma`)

| Model | Line | Role in HR | Assessment |
|---|---|---|---|
| `Teacher` | 894 | Teaching staff | Keep; will become a *specialization* of a unified staff person or gain an `Employee` link |
| `Employee` | 922 | General staff ("HR" table) | **Too thin** — 4 name fields + jobTitle + department + status. Needs to become the HR core |
| `EmploymentStatus` enum | — | `ACTIVE / ON_LEAVE / TERMINATED` | **Insufficient** — prompt needs a 16-state lifecycle |
| `TeacherAttendance` | 1470 | Teacher daily attendance | Keep; extend to all staff or generalize |
| `TeacherSection` | 961 | Teacher→section link | Keep (academic) |
| `Campus` | 597 | **Already exists** | Reuse as org root — do NOT create a duplicate |
| `LeaveRequest` | 2204 | **Student** leave (parent portal) | **Do NOT reuse for staff** — different domain; staff leave is a new model |
| `Bus` | 2463 | `driverName`/`driverPhone` strings | **Refactor** — drivers become Employees; Bus references `driverId` |
| `AuditLog` | 1177 | Generic before/after audit | **Reuse everywhere** — already has actor, before/after JSON, entityType/Id, ip, traceId |

**Missing entirely** (must be built): `Department`, `Position`, `Team`/`Division`, `EmploymentContract`,
`EmployeeStatusHistory`, `Vacancy`, `JobApplicant`, `Interview`, `StaffLeaveType`, `StaffLeaveBalance`,
`StaffLeaveRequest`, `PerformanceReview`, `Goal`/`KPI`, `TrainingCourse`, `TrainingEnrollment`,
`Asset`, `AssetAssignment`, `EmployeeDocument`, `EmergencyContact`, `Dependent`, `EmployeeEducation`,
`Certificate`, `BankAccount`, `DriverProfile` (license/medical/infractions), plus payroll-prep
aggregates.

### 1.2 API (`apps/api/src`)

| Module | Endpoints | Assessment |
|---|---|---|
| `people/teachers` | CRUD + section assignment, `teacher:manage` | Solid pattern; extend |
| `people/employees` | CRUD only, `employee:manage` | Thin; becomes the HR API root |
| `advanced/bus` | route/bus/area CRUD, `bus:read`/`bus:manage` | Driver data denormalized on payload — refactor |
| `parent-portal/leave-requests` | student leave | Not HR staff leave — leave as-is |

Patterns observed (good, reuse them): controller → service → repository; `@RequirePermissions`;
DTOs with class-validator; versioned routes (`version: '1'`); `TenantContextStore` for actor/tenant;
204 on delete; soft-delete via `deletedAt`.

### 1.3 RBAC (`packages/domain`)

- **Permissions** (`permissions.ts`): HR-relevant = only `teacher:manage`, `employee:manage`,
  `leave:request`, `leave:approve` (student), `bus:*`. **~30+ new HR permissions needed**
  (per-tab reads, contract manage, recruitment, performance, training, assets, documents,
  org manage, payroll-prep, self-service, manager approvals).
- **Roles** (`roles.ts`): `HR`, `FleetAdmin`, `BusSupervisor`, `Principal`, etc. **already exist** —
  wire new permissions into `role-permissions.ts` rather than inventing roles.

### 1.4 Admin UI (`apps/admin`)

- `/people/employees` — unified staff directory (KPIs, filters, merged Teacher+Employee table,
  profile dialogs, inline editor).
- `/people/teachers` — teacher CRUD + section assignment.
- `/fleet` — routes/buses/areas; driver picker seeded from active employees.
- Design system: `@school/ui`, design tokens, i18n (EN/AR, RTL), `RecordHeader`, `Tabs`,
  `StatusBadge`, `Shell`. **Employee/Teacher profile dialogs already contain a placeholder
  comment** for "payroll, contracts, leave, documents" — the intended extension point.

### 1.5 Cross-module integration points

| Module | HR touchpoint |
|---|---|
| Attendance | `TeacherAttendance` exists; staff attendance/overtime is the extension |
| Timetable / Scheduling | `Teacher` → `ScheduledClass`, `TeacherSection`, `ScheduleException` |
| Finance | Payroll-prep exports; no direct payroll module (correct — prompt says prepare only) |
| Fleet | Driver refactor (biggest cross-module change) |
| Communication | `NotificationAudit` exists; policy acknowledgements/announcements extend it |
| Audit | `AuditLog` — single source of truth for all HR mutations |
| Multi-tenant | Every new model needs `tenantId` + RLS + `@@index([tenantId])` |

---

## 2. Technical debt & risks found

1. **`Employee` and `Teacher` are parallel, unlinked person tables.** The unified directory merges
   them in the client. Enterprise HR needs one canonical "staff person." Decision required:
   (a) make `Employee` the core and link `Teacher` 1:1 to it, or (b) introduce a `StaffMember` base.
   Recommended: **`Employee` as core**, `Teacher.employeeId` FK, migrate demo data. Lower blast radius.
2. **`EmploymentStatus` enum is 3 states**; lifecycle needs 16 + a `EmployeeStatusHistory` table.
3. **Drivers are denormalized strings on `Bus`** — no license/medical/infraction tracking, no
   referential integrity. Refactor to `driverId → Employee` + `DriverProfile`.
4. **No per-tab authorization** — profile tabs would leak data without new granular permissions.
5. **No staff leave / balances / approval workflow** — the `leave:*` permissions exist but map to
   *student* leave only. Naming collision risk; namespace staff leave as `staff-leave:*`.
6. **No document/expiry/reminder infrastructure** for HR (contracts, visas, licenses).
7. **Scale**: prompt targets 100k+ employees/tenant. Current list endpoints are unpaginated — every
   new HR list endpoint must be cursor-paginated and indexed from day one.

No dead HR code or obsolete HR models were found (the surface is simply small). The `logo*.png`
files at repo root and several `*_REPORT.md` docs are unrelated clutter, not HR debt.

---

## 3. Recommended target architecture (single source of truth)

```
Employee (core staff person)  ──1:1──  Teacher (academic facet, optional)
   │                                     └─ TeacherSection, ScheduledClass …
   ├─ EmployeeStatusHistory (lifecycle transitions, audited)
   ├─ EmploymentContract (type, salary, allowances, dates, renewal)  ── ContractDocument
   ├─ Position ── Department ── Campus(existing) ── School/Tenant
   │      └─ reportsToId (manager) → org chart
   ├─ EmergencyContact / Dependent / EmployeeEducation / Certificate / BankAccount
   ├─ EmployeeDocument (versioned, expiry, permissioned)
   ├─ StaffLeaveRequest ── StaffLeaveBalance ── StaffLeaveType
   ├─ StaffAttendance (or generalized TeacherAttendance) ── overtime/corrections
   ├─ PerformanceReview ── Goal/KPI
   ├─ TrainingEnrollment ── TrainingCourse
   ├─ AssetAssignment ── Asset
   ├─ DriverProfile (license, medical, infractions) ──< Bus.driverId
   └─ all mutations → AuditLog (existing)

Recruitment plane:  Vacancy ──< JobApplicant ──< Interview ──(convert)──> Employee
```

Everything tenant-scoped (RLS), cursor-paginated, indexed, and permission-gated per facet.

---

## 4. Proposed phased delivery plan

Each phase is independently shippable, testable, and reviewable. Ordering respects dependencies.

| Phase | Deliverable | Depends on |
|---|---|---|
| **1 — Core & lifecycle** | Expand `Employee`; 16-state lifecycle + `EmployeeStatusHistory`; org (`Department`, `Position`, manager) reusing `Campus`; granular permissions; audited transitions; expanded profile workspace shell (tabs + per-tab perms) | — |
| **2 — Contracts & documents** | `EmploymentContract`, `EmployeeDocument` (versioned, expiry), emergency contacts/dependents/education/certificates/bank | 1 |
| **3 — Driver refactor** | `DriverProfile`; `Bus.driverId → Employee`; data migration off `driverName`; Fleet UI update | 1 |
| **4 — Leave** | `StaffLeaveType/Balance/Request`, multi-level approval, holiday awareness, calendar, payroll impact | 1 |
| **5 — Attendance & payroll-prep** | Generalize staff attendance, overtime, corrections; payroll-prep aggregates + export | 1, 4 |
| **6 — Performance & training** | Reviews, goals/KPIs, 360; training catalog/enrollment/certificates | 1 |
| **7 — Assets** | Asset registry + assignment lifecycle | 1 |
| **8 — Recruitment** | Vacancies, applicants, interviews, offer→hire conversion, candidate history | 1 |
| **9 — Portals** | Employee Self-Service + Manager portal (approvals, analytics) | 2,4,5,6 |
| **10 — Dashboard, reporting, automation** | HR dashboard widgets, report generators, reminder automation, AI-ready data shape | all |

---

## 5. Honest scope assessment

The prompt describes a **complete enterprise HRMS** (~25 sub-domains, 30+ new tables, 100+ new
endpoints, 15+ profile tabs, two new portals, dashboards, reporting, automation, plus a full test
and documentation pass). Realistically this is a **multi-person, multi-month program**, not a
single autonomous session. Attempting to emit all of it in one pass would produce large volumes of
**unverifiable, unbuildable code** — which directly violates the prompt's own "no placeholders, no
TODOs, must build with zero errors, must be production-ready" bar.

The responsible path is **incremental, verified delivery**: each phase implemented end-to-end
(schema → migration → API → RBAC → UI → tests → docs), building green, before the next. That way
every increment is genuinely production-quality, matching the prompt's intent even though the whole
program spans many sessions.

---

## 6. Immediate recommended next step

Begin **Phase 1** as the first verified increment:
1. Expand `EmploymentStatus` → full lifecycle enum + `EmployeeStatusHistory`.
2. Enrich `Employee` (identity, employment, org FKs, manager).
3. Add `Department`, `Position` (reuse existing `Campus`).
4. Add granular HR permissions + wire to existing roles.
5. Audited status-transition service + expanded profile workspace shell.
6. Migration (safe to reshape demo data), tests, `pnpm build` green, docs.

This is scoped to be fully implementable and verifiable in one working block.
