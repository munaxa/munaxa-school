# Timetable — Structure & UI

_Munaxa Phase 6 (Timetable Engine). Snapshot of the data model, resolution
engine, API surface, and the Admin/Mobile UI. Documentation only — no code changes._

---

## 1. Overview

The timetable is a **master weekly schedule** per section, overlaid with
**date-specific exceptions** (cancel / substitute / replace / holiday), plus a
**Ramadan mode** that swaps to an alternate master set. A pure, fully
unit-tested engine resolves the effective schedule for any given day and the
current/next class.

```
Master slots (REGULAR | RAMADAN)  ──┐
Date exceptions (per period / day) ─┼──►  resolveDay()  ──►  ResolvedDay
Campus Ramadan config              ──┘                         │
                                                findCurrentAndNext() ──► current / next
```

**Source map**

| Area | Location |
|------|----------|
| DB models + RLS | `prisma/migrations/20260603150000_timetable/migration.sql` |
| Pure engine (+ 14 unit tests) | `apps/api/src/timetable/engine/timetable-engine.ts` |
| Backend modules | `apps/api/src/timetable/{slots,exceptions,config,resolver}` |
| Admin UI | `apps/admin/src/app/(app)/timetable/page.tsx`, `src/lib/timetable.ts` |
| Mobile UI | `apps/mobile/lib/{data,features}/timetable`, `.../features/student/student_timetable_screen.dart` |
| e2e (5 cases) | `apps/api/test/timetable.e2e-spec.ts` |

---

## 2. Data model

Three tables, all tenant-isolated via Row-Level Security (`tenant_isolation`
policy: `tenantId = app_current_tenant() OR app_is_platform()`).

### Enums
- `DayOfWeek` — `SUN, MON, TUE, WED, THU, FRI, SAT`
- `ScheduleType` — `REGULAR, RAMADAN`
- `ExceptionType` — `CANCELLATION, SUBSTITUTION, REPLACEMENT, HOLIDAY`

### `TimetableSlot` — recurring weekly class
Uniquely keyed by `(tenantId, sectionId, scheduleType, dayOfWeek, periodIndex)`.
The `REGULAR` set is the master timetable; the `RAMADAN` set is the alternate.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `tenantId` | UUID | FK → Tenant (cascade) |
| `sectionId` | UUID | FK → Section (cascade) |
| `scheduleType` | ScheduleType | default `REGULAR` |
| `dayOfWeek` | DayOfWeek | |
| `periodIndex` | Int | |
| `startTime` / `endTime` | Text | `"HH:MM"` 24h, local school time |
| `subject` | Text | |
| `teacherId` | UUID? | FK → Teacher (set null) |
| `classroomId` | UUID? | FK → Classroom (set null) |

### `ScheduleException` — date-specific override
`periodIndex` null + `HOLIDAY` ⇒ whole-day cancel. `sectionId` null ⇒ school-wide.

| Column | Type | Notes |
|--------|------|-------|
| `date` | Date | the affected day |
| `sectionId` | UUID? | null ⇒ school-wide |
| `periodIndex` | Int? | null ⇒ whole day |
| `type` | ExceptionType | |
| `subject` | Text? | for `REPLACEMENT` |
| `teacherId` | UUID? | replacement teacher |
| `substituteTeacherId` | UUID? | for `SUBSTITUTION` |
| `classroomId` | UUID? | replacement room |
| `note` | Text? | |

### `TimetableConfig` — per-campus settings
Unique per `campusId`.

| Column | Type | Notes |
|--------|------|-------|
| `campusId` | UUID | FK → Campus, unique |
| `ramadanModeEnabled` | Bool | default false |
| `ramadanStartDate` / `ramadanEndDate` | Date? | inclusive window |

---

## 3. Resolution engine

Pure, framework-free (`apps/api/src/timetable/engine/timetable-engine.ts`).

```
resolveScheduleType(config, date):                        # step 4
  RAMADAN  if ramadanModeEnabled and date ∈ [start, end]  (inclusive, UTC day)
  REGULAR  otherwise

resolveDay({ slots, exceptions, scheduleType, dayOfWeek }):
  if whole-day HOLIDAY exists      → { isHoliday: true, periods: [] }      # steps 1-2
  periods ← slots matching scheduleType & dayOfWeek, sorted by periodIndex # step 3
  for each period, apply exceptions[periodIndex]:                          # steps 1-2
    CANCELLATION → CANCELLED
    SUBSTITUTION → SUBSTITUTED (+ substituteTeacherId)
    REPLACEMENT  → REPLACED    (+ subject/teacher/classroom from exception)

findCurrentAndNext(periods, nowMinutes):
  current ← period where start ≤ now < end and status ≠ CANCELLED
  next    ← earliest non-CANCELLED period starting after now
```

**Effective order** = the Phase-6 spec: schedule type selects the master set,
then exceptions are overlaid per period.

**Fail-safe behavior**
- Malformed `"HH:MM"` times throw (`timeToMinutes` regex-validated).
- Cancelled periods are never returned as "current".
- No tenant context ⇒ RLS returns nothing.

`ResolverService` (`resolver/resolver.service.ts`) loads slots, exceptions, and
config for a section/date, then runs the pure engine.

---

## 4. API — `/api/v1`

| Method | Path | Permission |
|--------|------|------------|
| CRUD | `/timetable/slots` (`?sectionId=`) | `timetable:manage` / `timetable:read` |
| CRUD | `/timetable/exceptions` (`?sectionId=&date=`) | `timetable:manage` / `timetable:read` |
| GET / PUT | `/timetable/config/:campusId` | `timetable:read` / `timetable:manage` |
| GET | `/timetable/sections/:sectionId/day?date=` | `timetable:read` |
| GET | `/timetable/sections/:sectionId/current?at=` | `timetable:read` |

**`ResolvedDay`** (day endpoint): `{ scheduleType, dayOfWeek, isHoliday, periods[] }`.
**`ResolvedPeriod`**: `{ periodIndex, startTime, endTime, subject, teacherId,
classroomId, status, substituteTeacherId, note }`.
**`CurrentClass`** (current endpoint): `{ scheduleType, isHoliday, current, next }`.

`status` ∈ `SCHEDULED | CANCELLED | SUBSTITUTED | REPLACED`.

---

## 5. UI

### 5.1 Admin Portal — `/timetable`
`apps/admin/src/app/(app)/timetable/page.tsx`

A weekly grid view resolving a section's schedule day-by-day.

**Controls**
- **Section** picker (`EntityPicker`, searchable).
- **Week of** date input — anchors the week.
- **Load week** button — fetches each of the 5 working days in parallel.

**Week model** — Jordan school week **Sunday → Thursday**. `weekDates(anchor)`
snaps to the Sunday on/before the anchor and yields the 5 working days.

**Grid**
- Rows = the **union of period indexes** across the week (times taken from the
  first day that defines each period).
- Columns = Sun–Thu, each header showing day name + `MM-DD` and a `· holiday`
  suffix when the day is a holiday.
- First column = `P{index}` with `start–end` times.
- Cells show the subject; holidays render `—`, empty period render `·`.

**Status color coding** (`STATUS_COLOR`)

| Status | Style |
|--------|-------|
| `SCHEDULED` | default foreground |
| `CANCELLED` | destructive, strike-through |
| `SUBSTITUTED` | aqua |
| `REPLACED` | coral |

Non-`SCHEDULED` cells also print the status label under the subject. A footer
badge shows the day's `scheduleType` (REGULAR / RAMADAN) plus a legend line.
All strings are i18n (`useI18n`); errors surface via toast.

**Data layer** — `src/lib/timetable.ts`: `timetableApi.day(sectionId, date)` →
`GET /timetable/sections/:id/day?date=`.

```
┌──────────────────────────────────────────────────────────┐
│  Timetable                                                │
│  [ Section ▾ ]  [ Week of 📅 ]  [ Load week ]             │
│ ┌────────┬───────┬───────┬───────┬───────┬───────┐        │
│ │ PERIOD │ Sun   │ Mon   │ Tue   │ Wed   │ Thu   │        │
│ │        │ 07-19 │ 07-20 │ 07-21 │ 07-22 │ 07-23 │        │
│ ├────────┼───────┼───────┼───────┼───────┼───────┤        │
│ │ P1     │ Math  │ Math  │ Sci   │ …     │ Arabic│        │
│ │ 08:00– │       │       │       │       │       │        │
│ │ 08:45  │       │       │       │       │       │        │
│ ├────────┼───────┼───────┼───────┼───────┼───────┤        │
│ │ P2     │ Sci   │ ~~Eng~~ CANCELLED  …           │        │
│ └────────┴───────┴───────┴───────┴───────┴───────┘        │
│  [ REGULAR ]  Legend: cancelled / substituted / replaced  │
└──────────────────────────────────────────────────────────┘
```

### 5.2 Mobile — Student weekly timetable
`apps/mobile/lib/features/student/student_timetable_screen.dart`

Riverpod-driven (`studentTimetableProvider`), pull-to-refresh.
Entries grouped by day (Sun–Thu first, Sat last), each day a header followed by
period cards — `ListTile` with a period-index avatar, subject title, and
`start – end` subtitle. Empty state: `empty.noTimetable`.

### 5.3 Mobile — Teacher "now / next" card
`apps/mobile/lib/features/timetable/timetable_providers.dart` +
`data/timetable/timetable_api.dart`

`currentClassProvider(sectionId)` → `GET /timetable/sections/:id/current`,
returning `CurrentClass { scheduleType, isHoliday, current, next }` to power the
Teacher app's live "now / next class" card. `TimetableApi.day()` provides the
full resolved day for a date.

---

## 6. Verified behavior
- **Unit (engine, 14):** time parsing, day mapping, Ramadan window (inclusive
  bounds + disabled), regular vs Ramadan selection, cancellation / substitution
  / replacement, whole-day holiday, current/next detection (before first,
  mid-class, after last, skip cancelled).
- **e2e (5, real DB):** regular day resolves 2 periods; current/next at 09:00 →
  period 2; cancellation marks CANCELLED; enabling Ramadan config switches the
  set; a Parent can read but cannot manage slots (403).

## 7. Known limitations / notes
- Times stored as local `"HH:MM"`; resolver reads wall-clock hours/minutes of
  the provided `at` (UTC). Full timezone/locale + Hijri display deferred.
- Conflict detection (overlapping periods, teacher double-booking) is a planned
  enhancement; the unique slot constraint already prevents duplicate
  `(section, scheduleType, day, period)` rows.
