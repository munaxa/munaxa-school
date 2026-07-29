import { Injectable } from '@nestjs/common';
import { TenantRepository } from '../../common/tenant.repository';
import {
  calendarFromDates,
  toDayKey,
  type WorkingDayCalendar,
} from '../../people/leave/leave-days.logic';

/**
 * Scheduling-backed working-day calendar (PR-2b).
 *
 * Scheduling is the canonical owner of "what kind of day is this date" (ADR-0001): school-wide
 * `ScheduleException(HOLIDAY)` rows already drive timetable resolution. This service exposes those
 * same rows as the pure {@link WorkingDayCalendar} port that leave and payroll consume, so holidays
 * have exactly one source of truth and the working-day rule is never forked.
 *
 * A *school-wide* holiday (`sectionId: null`) is what suspends work for staff; a section-scoped
 * holiday only cancels that section's classes and is deliberately ignored here.
 */
@Injectable()
export class WorkingDayCalendarService extends TenantRepository {
  /**
   * Build a calendar covering `[from, to]`. One query per range — callers then evaluate dates in
   * memory through the pure predicate, so there is no query per day.
   */
  async forRange(from: Date, to: Date): Promise<WorkingDayCalendar> {
    const holidays = await this.run((tx) =>
      tx.scheduleException.findMany({
        where: {
          type: 'HOLIDAY',
          sectionId: null, // school-wide only
          date: { gte: from, lte: to },
        },
        select: { date: true },
      }),
    );
    return calendarFromDates(holidays.map((h) => toDayKey(h.date)));
  }
}
