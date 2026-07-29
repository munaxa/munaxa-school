# ADR-0001 — Holiday/working-day calendar ownership

- **Status:** Accepted
- **Date:** 2026-07-24
- **Context program:** HR × Attendance enterprise evolution

## Context

The program requires attendance and payroll working-day math to become
"calendar-aware" (public holidays, closures, special working days). A naive
reading suggests a new `AcademicCalendar` aggregate in HR.

A repository-wide search established:
- `AcademicYear` / `Semester` model **instructional boundaries only** (start/end,
  registration windows) — not holidays.
- Scheduling's `ScheduleException(HOLIDAY)` already models date-specific,
  per-section-or-school-wide non-instructional days, and is the resolver's source
  of truth for "what happens on this date."
- The working-day rule lives in exactly one pure helper, `workingDaysBetween`
  (`leave-days.logic.ts`), shared by leave and payroll.

## Decision

1. **Do not introduce a new HR `AcademicCalendar` model.** That would create a
   second source of truth for holidays and violate single-owner governance.
2. The **Scheduling context (C3)** remains the canonical owner of "what kind of
   day is a date." It is extended (day-type taxonomy + a holiday/working-day
   **port**) rather than duplicated.
3. The **working-day arithmetic (C8)** is evolved in place: `workingDaysBetween`
   gains an optional injected `WorkingDayCalendar`. With no calendar it behaves
   exactly as before (weekend-only). A Scheduling-backed provider supplies the
   calendar to leave and payroll.

## Consequences

- One holiday source of truth; one working-day helper. No fork.
- Backward compatible: every existing 2-arg call is unchanged (regression-tested).
- HR depends on Scheduling only through a small pure port (no circular module
  dependency; the port is injected).
- Follow-up (PR-2b): implement the Scheduling-backed provider and thread it into
  leave/payroll. Requires a database to validate end-to-end.

## Alternatives rejected

- **New HR `AcademicCalendar` model** — rejected: duplicate ownership of holidays.
- **Fork the weekend rule with holiday logic inside payroll** — rejected: two
  divergent working-day calculations.
