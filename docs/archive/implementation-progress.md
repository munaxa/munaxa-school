# HR × Attendance Evolution — Implementation Progress

> **ARCHIVED — historical record, not current guidance.** This is a point-in-time report
> from a completed programme. It may describe structures that no longer exist. Do not
> follow it and do not edit it. For what is true now, start at
> [`/docs/README.md`](../../../docs/README.md). Context: [`./README.md`](./README.md).

_Live status of the atomic-PR program defined in
`HR_ATTENDANCE_ENTERPRISE_ARCHITECTURE.md` (Phase 3). Kept in sync with the code._

Branch: `claude/attendance-structure-ui-docs-lxo7qc`
Environment: Node 22 · pnpm 10 · **no TCP route to Postgres** (see Blockers).

**Status: all 15 planned PRs authored and merged to the working branch.** Every gate
that can execute in this environment passes. The only outstanding work is
migration application and integration/e2e execution, which require a
TCP-connected database — see the final checklist at the bottom.

---

## Validation environment (which gates are runnable here)

| Gate | Runnable? | Latest result |
|------|-----------|---------------|
| Prisma generate + format | ✅ | pass (schema valid) |
| TypeScript (monorepo) | ✅ | **18/18 packages pass** |
| ESLint (monorepo) | ✅ | **18/18 packages pass** |
| Unit tests (API) | ✅ | **62 suites / 464 tests pass** |
| Monorepo `test` | ✅ | pass |
| API production build (`nest build`) | ✅ | pass |
| Integration / E2E | ❌ | require Postgres — specs authored, not executed |
| Migration apply | ❌ | requires Postgres |

---

## Landed PRs

| PR | Title | Owner (matrix) | Extend/New |
|----|-------|----------------|-----------|
| Docs | Audit, plan, Capability Ownership Matrix, ADR-0001 | governance | — |
| PR-1 | `StaffAttendanceRecorded` integration event | C1 events / C6 HR | EXTEND |
| PR-2 | Calendar-aware `workingDaysBetween` (+ port) | C8 leave | EXTEND |
| PR-2b | Scheduling-backed calendar provider | C3 scheduling | EXTEND |
| PR-3 | Attendance policy engine (pure core) | N2 | NEW core |
| PR-3b | Policy persistence + API | N2 | NEW |
| PR-4 | Shift-window engine (pure core) | N1 | NEW core |
| PR-4b | Shift persistence + assignment API | N1 | NEW |
| PR-5 | Teacher-attendance sync (HR→Academics) | C5 academics | EXTEND |
| PR-6 | Teacher availability read-model | C5/C3/C8 | EXTEND |
| PR-7 | Driver→Transport duty sync | C13 transport | EXTEND |
| PR-8 | Attendance notification catalog (13 events) | C2 communication | EXTEND |
| PR-9 | Attendance locking + write guard | N3 | NEW |
| PR-10 | Correction workflow (request→approve→apply) | N4 | NEW |
| PR-11 | Biometric provider layer + ingestion | N5 | EXTEND ingestion |
| PR-12 | Attendance analytics | C9/C10 | EXTEND |
| PR-13 | Payroll `Validated` stage | C7 payroll | EXTEND |
| PR-14 | Admin attendance-ops console | design system | EXTEND |

### Behavioural safety

Every change is additive and default-off:

- The new domain event has consumers, but `usage.service` ignores it via its
  existing `default` branch — no existing behaviour changed.
- `workingDaysBetween` keeps its exact original semantics when no calendar is
  passed (regression-tested).
- Policy resolution falls back to `DEFAULT_ATTENDANCE_POLICY`, so tenants that
  never configure a policy behave exactly as before.
- Shift derivation is skipped entirely when an employee has no assigned shift.
- Locks only exist once created; with no locks, the write guard is a no-op.

**Breaking changes: none.** No existing endpoint, DTO, column, enum value or
public signature changed meaning. Repository return types were enriched
internally (`record`/`bulkRecord`) without altering HTTP contracts.

---

## Migrations added (repository order, additive)

| Migration | Contents |
|-----------|----------|
| `20260726120000_attendance_shift_policy` | `AttendancePolicy`, `Shift`, `EmployeeShiftAssignment`, enum `ShiftKind` |
| `20260726130000_attendance_lock` | `AttendanceLock`, enums `AttendanceLockScope`, `AttendanceLockStatus` |
| `20260726140000_attendance_correction` | `AttendanceCorrectionRequest`, `AttendanceCorrectionApproval`, 2 enums |
| `20260726150000_biometric_punch` | `BiometricRawPunch`, enum `BiometricPunchDirection` |

Each migration: creates only new objects (no destructive DDL), enables **and
forces** RLS with the standard `tenant_isolation` policy, and grants CRUD to
`munaxa_app` when that role exists — mirroring
`20260723160000_hr_staff_attendance` exactly.

---

## Final duplicate-detection audit (repository-wide)

| Check | Expected | Actual |
|-------|----------|--------|
| Domain event buses | 1 | ✅ 1 (`events/domain-events.ts`) — notifications remain a subscriber |
| `workingDaysBetween` definitions | 1 | ✅ 1 (`leave/leave-days.logic.ts`) |
| Attendance tally (`summarizeAttendance`) | 1 | ✅ 1 (`payroll-prep.logic.ts`) |
| `HH:MM` parsers (`timeToMinutes`) | 1 | ✅ 1 (`scheduling-engine.ts`) |
| `StaffAttendance` write sites | 1 repository | ✅ only `attendance.repository.ts` |
| Holiday/calendar models | 0 new | ✅ 0 (Scheduling remains the owner) |
| Notification delivery paths | 1 | ✅ engine only; producers emit catalog events |
| Approval engines | per-context | ✅ correction reuses the leave pattern; no generic engine |

The architecture has **one canonical owner per capability**, unchanged from the
matrix.

---

## Risk Register

| ID | Risk | Severity | Status |
|----|------|----------|--------|
| R1 | Dual event buses drift | Med | **Mitigated** — extended the existing bus; notifications stay a subscriber |
| R2 | In-process events are not durable (lost on crash) | Med | **Accepted (TD1)** — syncs are idempotent and reconcilable; outbox deferred |
| R3 | `lateMinutes` caller-supplied | Low | **Resolved** — derived by shift+policy on the biometric path |
| R4 | Calendar rule fork between leave & payroll | Med | **Closed** — one helper, one calendar owner, regression-tested |
| R5 | Migration safety for new tables | Med | **Mitigated in code** — additive + RLS + grants; **needs apply to verify** |
| R6 | E2E unverified in this environment | High | **Open** — specs authored; must run against Postgres |

## Technical Debt Register

| ID | Item | Rationale |
|----|------|-----------|
| TD1 | No transactional outbox | In-process bus acceptable for v1; syncs are idempotent and reconcilable. Revisit when a lost projection becomes business-critical. |
| TD2 | Shift engine handles same-day windows only | Overnight shifts deferred; documented in `shift-window.logic.ts`. |
| TD3 | Biometric adapters ship only `generic-rest` | The port + registry exist; vendor adapters are added without touching the write path. |
| TD4 | Analytics `missingAttendanceDays` always 0 | The expensive expected-vs-actual scan is deferred; surfaced as a warning field only. |
| TD5 | Manager-scoped correction approval | Approval currently uses permissions; direct-report scoping can extend the self-service pattern later. |

---

## ⚠️ Required in a TCP-connected environment

Nothing below can run here (no route to Postgres; the Supabase MCP is an HTTPS
API, not a database connection). Run in order:

```bash
# 0. Prerequisites
pnpm install
pnpm build --filter=@school/domain --filter=@school/ui --filter=@school/i18n
export DATABASE_URL="postgresql://<user>:<pass>@<host>:5432/<db>"

# 1. Apply migrations (staging's public schema is currently EMPTY with an empty
#    Prisma ledger, so this applies all 85 migrations cleanly and populates the
#    ledger via Prisma itself — no manual baselining).
pnpm --filter @school/api exec prisma migrate deploy --schema=../../prisma/schema.prisma

# 2. Confirm schema and ledger agree (must report no drift / no pending migration)
pnpm --filter @school/api exec prisma migrate status --schema=../../prisma/schema.prisma

# 3. Verify RLS + grants landed on the 6 new tables
#    Expect relrowsecurity = true AND relforcerowsecurity = true for each:
#      AttendancePolicy, Shift, EmployeeShiftAssignment,
#      AttendanceLock, AttendanceCorrectionRequest, AttendanceCorrectionApproval,
#      BiometricRawPunch
psql "$DATABASE_URL" -c "select relname, relrowsecurity, relforcerowsecurity
  from pg_class where relname in ('AttendancePolicy','Shift','EmployeeShiftAssignment',
  'AttendanceLock','AttendanceCorrectionRequest','AttendanceCorrectionApproval','BiometricRawPunch');"

# 4. Regenerate the client against the applied schema
pnpm --filter @school/api prisma:generate

# 5. Run the full e2e suite (includes the new attendance-evolution spec)
pnpm --filter @school/api test:e2e

# 6. Targeted: the new program spec on its own
pnpm --filter @school/api exec jest --config ./test/jest-e2e.json attendance-evolution

# 7. Regression: the pre-existing attendance/HR suites must stay green
pnpm --filter @school/api exec jest --config ./test/jest-e2e.json attendance hr-attendance

# 8. Full gate sweep
pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @school/api build
```

**What to watch for on first run**

- `attendance-evolution.e2e-spec.ts` asserts a 409 when writing inside a lock and
  that an approved correction still applies — that pair is the core of PR-9/PR-10.
- The biometric spec asserts `LATE` with `lateMinutes = 20` (08:20 against an
  08:00 shift with the strict policy's 0-minute grace), which exercises the whole
  N1→N2→write chain.
- If the RBAC assertions fail, confirm the new permissions were seeded to roles
  (`packages/domain/src/role-permissions.ts` → HR role) for the test tenant.
