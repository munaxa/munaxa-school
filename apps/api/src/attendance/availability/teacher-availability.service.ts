import { Injectable } from '@nestjs/common';
import { TeacherAvailabilityRepository } from './teacher-availability.repository';
import { resolveTeacherAvailability, type TeacherAvailability } from './teacher-availability.logic';

export interface TeacherAvailabilityResult extends TeacherAvailability {
  teacherId: string;
  date: string;
}

/**
 * Teacher availability service (PR-6) — the single place Academic scheduling asks "can this teacher
 * take their classes?". Business rules live in the pure {@link resolveTeacherAvailability}; this
 * service only fetches facts and folds them, so no attendance/leave/substitution logic is
 * duplicated (Rule 4/5).
 */
@Injectable()
export class TeacherAvailabilityService {
  constructor(private readonly repo: TeacherAvailabilityRepository) {}

  async forTeacher(teacherId: string, date: string): Promise<TeacherAvailabilityResult> {
    const facts = await this.repo.factsForTeacher(teacherId, parseDay(date));
    return { teacherId, date: date.slice(0, 10), ...resolveTeacherAvailability(facts) };
  }

  /** Batch resolution for a roster — a fixed number of queries, never N+1. */
  async forTeachers(teacherIds: string[], date: string): Promise<TeacherAvailabilityResult[]> {
    const facts = await this.repo.factsForDate(teacherIds, parseDay(date));
    return teacherIds.map((teacherId) => {
      const f = facts.get(teacherId) ?? {
        attendanceStatus: null,
        onApprovedLeave: false,
        hasSubstitution: false,
      };
      return { teacherId, date: date.slice(0, 10), ...resolveTeacherAvailability(f) };
    });
  }
}

/** Parse an ISO date to UTC midnight, matching how `@db.Date` columns are stored. */
function parseDay(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}
