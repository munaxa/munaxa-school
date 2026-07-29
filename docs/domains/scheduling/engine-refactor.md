# Timetable → Enterprise Scheduling Engine — Refactor

## Context

The Munaxa timetable was **time-slot oriented**: flat `TimetableSlot` rows hung off a `Section` with
a `periodIndex`, no semester link, and no draft/publish lifecycle. Real K–12 schools work differently
— a timetable belongs to a **Section**, is versioned as a **Schedule Plan** inside a **Semester**, is
**published** once (after conflicts clear), and everyone else (students, parents, teachers,
attendance) **inherits** it. Students never own timetable records.

Per the agreed architecture decisions, this is a **clean cut-over, not an additive shim** — the
previous timetable data was development/test only, so the legacy model is **dropped** and no
compatibility layer is kept.

New hierarchy:

```
AcademicYear → Semester → SchedulePlan → SectionTimetable → ScheduledClass
                          (DRAFT/PUBLISHED/ARCHIVED)         ("Class", not "Period")
```

Inheritance (no per-person timetable rows):

```
Student → Enrollment → Section ┐
Teacher → TeacherSection ──────┼→ PUBLISHED SchedulePlan → SectionTimetable → ScheduledClass
Parent  → child's Enrollment ──┘
```

## Decisions applied in this pass

1. **"Class" not "Period"** — new models use `classNumber`; `ScheduleException.periodIndex` and
   `StudentAttendance.periodIndex` were **renamed** to `classNumber` (DB + DTOs + services +
   controllers + tests).
2. **Schedule belongs to the Section** — hierarchy above; students inherit via Enrollment → Section.
3. **Classroom handling** — normal lessons carry **no room**; `ScheduledClass.locationId` /
   `ScheduleException.locationId` are optional `SpecialLocation` refs (lab/gym/library/…). Null ⇒ the
   section's assigned classroom (never displayed as a room number). Legacy `classroomId` was removed
   from `ScheduleException`.
4. **Live current class** — pure, reusable `buildLiveContext` (below); nothing stored.
7. **Subject entity** — first-class `Subject` (name En/Ar, `code`, `colorHex`) is now the reference
   for `ScheduledClass.subjectId` and `ScheduleException.subjectId`. See "Subject rollout" for the
   remaining domains.
8. **Test data** — legacy `TimetableSlot` dropped; obsolete APIs/modules removed; **no** backfill or
   compatibility layer.

## Delivered (foundation — verified)

| Item | File | Status |
|------|------|--------|
| Prisma models/enums/relations; legacy `TimetableSlot` removed; `ScheduleException` modernised; `StudentAttendance.classNumber` | `prisma/schema.prisma` | ✅ `prisma validate` passes |
| Clean-replacement migration (drop legacy, alter exception/attendance, create new tables, RLS) | `prisma/migrations/20260720120000_scheduling_engine/migration.sql` | ✅ written |
| Pure resolution + live-context + conflict engine | `apps/api/src/timetable/engine/scheduling-engine.ts` | ✅ written |
| Engine unit tests | `apps/api/src/timetable/engine/scheduling-engine.spec.ts` | ✅ written |
| Removed obsolete backend: legacy engine, `slots/`, `resolver/`, `exceptions/`, `timetable.e2e` | — | ✅ deleted |
| Consumers realigned: `me.*`, `academic-year.repository`, attendance + presence (`classNumber`), e2e specs | (various) | ✅ updated |

### New models
`Subject`, `SpecialLocation`, `BellSchedule` / `BellSchedulePeriod`, `SchedulePlan` (partial-unique
**one PUBLISHED per semester**), `SectionTimetable` (one per `plan+section`), `ScheduledClass`
(unique `sectionTimetable, scheduleType, dayOfWeek, classNumber`). All carry `tenantId`, soft delete
where recoverable, and the `tenant_isolation` RLS policy.

### Engine API (`scheduling-engine.ts`, pure & reusable)
- `resolveScheduleType` (REGULAR/RAMADAN), `resolveDay` (overlays cancel/substitute/replace/holiday),
  `findCurrentAndNext`.
- `buildLiveContext(day, nowMinutes)` — shared live-card model: state ∈
  `IN_CLASS | BEFORE_SCHOOL | BREAK | AFTER_SCHOOL | HOLIDAY | NO_CLASSES` + `remainingClasses`,
  `minutesUntilCurrentEnds`, `minutesUntilNextStarts`. **Computed from server time; never stored.**
- `detectConflicts` → `TEACHER_DOUBLE_BOOKING`, `SECTION_OVERLAP`, `MISSING_TEACHER`, `INVALID_TIME`
  (ERROR) + `SUBJECT_DUPLICATION` (WARNING); `canPublish` gates publishing.

---

## Phase 2 — the unified SchedulingService (delivered)

One `SchedulingService` (`apps/api/src/scheduling/scheduling.service.ts`) is now the single authority
for all schedule resolution and publishing rules; **every** surface calls it (no parallel logic, no
empty-array gaps):

- **Engine module** `apps/api/src/scheduling/` — `SchedulingService` + `SchedulingRepository` (the one
  place the canonical pipeline **Published Plan → Section Timetable → Scheduled Class → Exception →
  Special Location** is read), the pure engine, and CRUD/lifecycle resources.
- **Subjects / Special Locations** — full CRUD (`/subjects`, `/special-locations`).
- **Schedule Plans** — `/schedule/plans/*`: create, duplicate, copy-previous-semester, publish
  (blocks on any ERROR conflict; supersedes the prior published plan), archive, restore, delete
  (guards: published cannot be deleted; audited), inline class CRUD, clear day/section, bulk replace
  teacher/subject, `validate`.
- **Live current-class resolver** — server-time states `IN_CLASS / BEFORE_SCHOOL / MORNING_ASSEMBLY /
  BREAK / LUNCH_BREAK / AFTER_SCHOOL / HOLIDAY / NO_CLASSES` (assembly/lunch from the bell schedule),
  never stored.
- **Unified read API** — `GET /schedule/{section,day,current,student,teacher,teacher/current}`.
- **Consumers wired to the one service:** Student portal (`/me/timetable`, `/me/timetable/current`),
  Parent portal (`/parent/timetable`, `/parent/timetable/current` — "Now Attending"), Attendance
  (`/attendance/students/current-class` derives the class from the published timetable), and the
  **Admin scheduling workspace** (`apps/admin/src/app/(app)/timetable/page.tsx` + `lib/scheduling.ts`)
  — Year/Semester/Plan selectors, weekly grid with subject colours, conflict/validation panel,
  publish/archive/restore/duplicate/delete/copy-previous-semester, inline class editing. All business
  rules live in the service; the UI only orchestrates.
- **Mobile** migrated to the new endpoints/shape (`/me/timetable` grouped, `/schedule/current|day`,
  `classNumber`).

Deferred by explicit agreement: drag-and-drop, PDF/Excel export, AI generation, advanced reporting,
and the Subject-as-SSoT rollout to Homework/Gradebook/exams.

## Phase 3 — timezone correctness, exceptions API, E2E (delivered)

- **School-level IANA timezone** (`School.timezone`, default `Asia/Amman`, managed via
  `PATCH /schools/:id`, validated against the runtime tz database). The live engine resolves the
  current class, breaks, holidays and exceptions in the **school's** timezone via the pure, DST-safe
  `zonedNow(instant, timeZone)` — never server/UTC time. All live paths (student/parent/teacher/
  attendance/admin) use it; unit tests cover UTC-offset, day-boundary rollover, and DST.
- **Schedule Exception API** re-added under the scheduling module
  (`/schedule/exceptions`, create/list/delete) — the resolver already overlays them.
- **Comprehensive E2E** (`apps/api/test/scheduling.e2e-spec.ts`): plan → classes → validate →
  publish → student/parent/teacher inheritance → timezone-correct current class → attendance current
  class → holiday + cancellation exceptions → teacher double-booking + section overlap (publish 409)
  → archive/restore/delete → RBAC + section scoping → timezone settings.
- **Caching:** a tenant-scoped TTL cache for the *immutable* settings reads (school timezone, bell
  schedule) on the hot live path; live state is never cached.

## Earlier notes (superseded where Phase 2 covers them)

Each NestJS resource follows the existing `{controller, service, repository, dto}` pattern
(`apps/api/src/structure/semesters/*` is the template).

### Backend — `apps/api/src/timetable/`
1. **`subjects/`**, **`special-locations/`** — CRUD (`timetable:manage`).
2. **`plans/`** — create DRAFT, `duplicate`, `copyFromSemester`, `validate` (→ `detectConflicts`),
   `publish` (**409 if `!canPublish`**; sets PUBLISHED; partial index enforces exclusivity),
   `archive`/`restore`, `remove` (guard: not PUBLISHED, not used by attendance; write `AuditLog`).
3. **`section-timetables/`** — manage `ScheduledClass` rows (inline CRUD, clear day/section, bulk
   replace teacher/subject).
4. **`resolver/`** (rebuild) — `sectionId + date` → published plan → `SectionTimetable` →
   `ScheduledClass[]` → `resolveDay`; `currentClass` → `buildLiveContext`.
5. **`exceptions/`** (rebuild) — CRUD on the modernised `ScheduleException` (classNumber/subjectId/
   locationId), overlaid by the resolver.

### Inheritance & integration
- **Student portal** `me.service.timetable()` currently returns `[]` — repoint to the resolver via the
  student's active Enrollment → section; add `liveClass()`.
- **Parent/Teacher portals**, **Attendance** (derive current class/subject/teacher), **dashboards** —
  all reuse the resolver + `buildLiveContext`.

### Admin workspace — `apps/admin/src/app/(app)/timetable/`
Production-usable first cut: Year/Semester/Plan selectors + status; weekly grid; Grade/Section/Teacher/
Subject filters (colours from `Subject.colorHex`); conflict/validation panel; Publish/Archive/Delete/
Duplicate/Copy-Previous-Semester. Drag-and-drop, PDF/Excel export, AI generation = later iterations.

### Mobile — `apps/mobile/lib/features/{student,timetable}/`
Point at the inherited published plan; add the live "Now Attending / Next / remaining" card with the
non-class states.

### Subject rollout (decision 7, follow-up)
`Subject` is the SSoT; migrate the remaining free-text `subject` strings to `subjectId` **with their
services**, per domain: `Homework`, `GradeRecord` (+ its unique index), `TeacherSection` (workload),
`Resource`, and exams/report-cards/curriculum when those modules land.

> **Transitional gaps: closed.** The admin page and mobile now call the unified `/schedule/*` and
> `/me/timetable` endpoints; `me/timetable` resolves the inherited published plan (no empty-array
> placeholder). There is one scheduling implementation.

---

## Verification

1. **Schema:** `DATABASE_URL=… DIRECT_DATABASE_URL=… npx prisma validate` — ✅ passes (+ `prisma format`).
2. **Engine tests:** `pnpm --filter @school/api test scheduling-engine` (resolution, Ramadan, live
   states, all conflict types, publish gate).
3. **Migration (against a DB):** `pnpm prisma:migrate` — legacy `TimetableSlot` dropped;
   `ScheduleException`/`StudentAttendance` altered; new tables + RLS created.

> **Note:** dependencies are not installed in this environment, so `tsc`/`jest` were not run here. The
> Prisma schema was validated + formatted with the Prisma CLI; the engine + tests are framework-free.
> All API references to the removed models/fields were grep-verified to be gone.
