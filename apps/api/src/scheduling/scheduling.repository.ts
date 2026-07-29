import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { TenantRepository } from '../common/tenant.repository';
import type {
  DayOfWeek,
  ScheduleType,
  ExceptionType,
  RamadanConfig,
} from './engine/scheduling-engine';

/** A scheduled class flattened with its joined subject/teacher/location display fields. */
export interface LoadedClass {
  id: string;
  sectionId: string;
  scheduleType: ScheduleType;
  dayOfWeek: DayOfWeek;
  classNumber: number;
  startTime: string;
  endTime: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  teacherId: string | null;
  teacherName: string | null;
  locationName: string | null;
}

export interface LoadedException {
  classNumber: number | null;
  type: ExceptionType;
  subjectName: string | null;
  teacherId: string | null;
  teacherName: string | null;
  substituteTeacherId: string | null;
  substituteTeacherName: string | null;
  note: string | null;
}

export interface LoadedBreak {
  startTime: string;
  endTime: string;
  kind: 'ASSEMBLY' | 'LUNCH' | 'BREAK';
  label: string | null;
}

/** Everything needed to resolve one section on one date. `planId` null ⇒ no published plan. */
export interface SectionDayData {
  campusId: string;
  planId: string | null;
  ramadan: RamadanConfig | null;
  classes: LoadedClass[];
  exceptions: LoadedException[];
  breaks: LoadedBreak[];
}

/** A teacher's scheduled class for a day, carrying the section/grade labels for the teacher card. */
export interface LoadedTeacherClass extends LoadedClass {
  sectionName: string;
  gradeNameEn: string;
  gradeNameAr: string;
  campusId: string;
  schoolTimezone: string;
}

const fullName = (p: { firstNameEn: string; lastNameEn: string } | null): string | null =>
  p ? `${p.firstNameEn} ${p.lastNameEn}`.trim() : null;

function atUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

const classInclude = {
  subject: true,
  teacher: { select: { firstNameEn: true, lastNameEn: true } },
  location: { select: { nameEn: true } },
} satisfies Prisma.ScheduledClassInclude;

const DEFAULT_TIMEZONE = 'Asia/Amman';

/**
 * Small tenant-scoped TTL cache for IMMUTABLE, settings-level scheduling data that is safe to reuse
 * (school timezone, bell schedule). Live state (current class, exceptions, published-plan contents)
 * is never cached — it is always resolved fresh. Keys embed the tenantId, so there is no cross-tenant
 * reuse; a short TTL bounds staleness after a settings change.
 */
class TtlCache<T> {
  private readonly store = new Map<string, { value: T; expires: number }>();
  constructor(private readonly ttlMs: number) {}
  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;
    if (hit) this.store.delete(key);
    return undefined;
  }
  set(key: string, value: T): void {
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
  }
}

const SETTINGS_TTL_MS = 5 * 60 * 1000;
const timezoneCache = new TtlCache<string>(SETTINGS_TTL_MS);
const bellCache = new TtlCache<LoadedBreak[]>(SETTINGS_TTL_MS);

/**
 * Canonical scheduling data access. Everything that resolves a schedule reads through here so the
 * pipeline (Published Plan → Section Timetable → Scheduled Class → Exception → Location) lives in one
 * place. RLS scopes every query to the active tenant.
 */
@Injectable()
export class SchedulingRepository extends TenantRepository {
  /** Resolve the PUBLISHED plan that governs a section on `date` (semester containing the date). */
  private async publishedPlanId(
    tx: Prisma.TransactionClient,
    campusId: string,
    date: Date,
  ): Promise<string | null> {
    const year = await tx.academicYear.findFirst({ where: { campusId, status: 'ACTIVE' } });
    if (!year) return null;
    const semesters = await tx.semester.findMany({
      where: { academicYearId: year.id },
      orderBy: { sequence: 'asc' },
    });
    const day = atUtcMidnight(date);
    const semester =
      semesters.find((s) => day >= atUtcMidnight(s.startDate) && day <= atUtcMidnight(s.endDate)) ??
      semesters[0];
    if (!semester) return null;
    const plan = await tx.schedulePlan.findFirst({
      where: { semesterId: semester.id, status: 'PUBLISHED', deletedAt: null },
      select: { id: true },
    });
    return plan?.id ?? null;
  }

  private mapClass(c: {
    id: string;
    sectionTimetable: { sectionId: string };
    scheduleType: ScheduleType;
    dayOfWeek: DayOfWeek;
    classNumber: number;
    startTime: string;
    endTime: string;
    subjectId: string;
    subject: { nameEn: string; colorHex: string };
    teacherId: string | null;
    teacher: { firstNameEn: string; lastNameEn: string } | null;
    location: { nameEn: string } | null;
  }): LoadedClass {
    return {
      id: c.id,
      sectionId: c.sectionTimetable.sectionId,
      scheduleType: c.scheduleType,
      dayOfWeek: c.dayOfWeek,
      classNumber: c.classNumber,
      startTime: c.startTime,
      endTime: c.endTime,
      subjectId: c.subjectId,
      subjectName: c.subject.nameEn,
      subjectColor: c.subject.colorHex,
      teacherId: c.teacherId,
      teacherName: fullName(c.teacher),
      locationName: c.location?.nameEn ?? null,
    };
  }

  /** Bell-schedule break windows for a campus. Immutable settings data — cached (tenant-scoped). */
  private async bellBreaks(
    tx: Prisma.TransactionClient,
    tenantId: string,
    campusId: string,
  ): Promise<LoadedBreak[]> {
    const key = `${tenantId}:${campusId}`;
    const cached = bellCache.get(key);
    if (cached) return cached;
    const bell = await tx.bellSchedule.findFirst({
      where: { campusId, deletedAt: null },
      include: { periods: { where: { isBreak: true } } },
    });
    const breaks: LoadedBreak[] = (bell?.periods ?? []).map((p) => ({
      startTime: p.startTime,
      endTime: p.endTime,
      kind: /assembl/i.test(p.labelEn ?? '')
        ? 'ASSEMBLY'
        : /lunch/i.test(p.labelEn ?? '')
          ? 'LUNCH'
          : 'BREAK',
      label: p.labelEn,
    }));
    bellCache.set(key, breaks);
    return breaks;
  }

  /** Load one section on one date (the core resolver input). */
  loadSectionDay(sectionId: string, date: Date): Promise<SectionDayData | null> {
    return this.run(async (tx, tenantId) => {
      const section = await tx.section.findFirst({
        where: { id: sectionId },
        select: { grade: { select: { campusId: true } } },
      });
      if (!section) return null;
      const campusId = section.grade.campusId;

      const planId = await this.publishedPlanId(tx, campusId, date);
      const [ramadanRow, breaks] = await Promise.all([
        tx.timetableConfig.findFirst({ where: { campusId } }),
        this.bellBreaks(tx, tenantId, campusId),
      ]);

      let classes: LoadedClass[] = [];
      if (planId) {
        const st = await tx.sectionTimetable.findFirst({
          where: { planId, sectionId, deletedAt: null },
          include: {
            classes: { include: classInclude },
          },
        });
        classes = (st?.classes ?? []).map((c) =>
          this.mapClass({ ...c, sectionTimetable: { sectionId } }),
        );
      }

      const day = atUtcMidnight(date);
      const exceptionRows = await tx.scheduleException.findMany({
        where: { date: day, OR: [{ sectionId }, { sectionId: null }] },
        include: {
          subject: { select: { nameEn: true } },
          teacher: { select: { firstNameEn: true, lastNameEn: true } },
          substitute: { select: { firstNameEn: true, lastNameEn: true } },
        },
      });

      return {
        campusId,
        planId,
        ramadan: ramadanRow
          ? {
              ramadanModeEnabled: ramadanRow.ramadanModeEnabled,
              ramadanStartDate: ramadanRow.ramadanStartDate,
              ramadanEndDate: ramadanRow.ramadanEndDate,
            }
          : null,
        classes,
        exceptions: exceptionRows.map((e) => ({
          classNumber: e.classNumber,
          type: e.type,
          subjectName: e.subject?.nameEn ?? null,
          teacherId: e.teacherId,
          teacherName: fullName(e.teacher),
          substituteTeacherId: e.substituteTeacherId,
          substituteTeacherName: fullName(e.substitute),
          note: e.note,
        })),
        breaks,
      };
    });
  }

  /** The school's IANA timezone for a section. Immutable settings data — cached (tenant-scoped). */
  schoolTimezoneForSection(sectionId: string): Promise<string> {
    return this.run(async (tx, tenantId) => {
      const key = `${tenantId}:${sectionId}`;
      const cached = timezoneCache.get(key);
      if (cached) return cached;
      const section = await tx.section.findFirst({
        where: { id: sectionId },
        select: {
          grade: { select: { campus: { select: { school: { select: { timezone: true } } } } } },
        },
      });
      const tz = section?.grade.campus.school.timezone ?? DEFAULT_TIMEZONE;
      timezoneCache.set(key, tz);
      return tz;
    });
  }

  /** The IANA timezone of a teacher's school (from any published class). Cached (tenant-scoped). */
  teacherTimezone(teacherId: string): Promise<string> {
    return this.run(async (tx, tenantId) => {
      const key = `${tenantId}:teacher:${teacherId}`;
      const cached = timezoneCache.get(key);
      if (cached) return cached;
      const cls = await tx.scheduledClass.findFirst({
        where: { teacherId, sectionTimetable: { plan: { status: 'PUBLISHED', deletedAt: null } } },
        select: {
          sectionTimetable: {
            select: {
              section: {
                select: {
                  grade: {
                    select: { campus: { select: { school: { select: { timezone: true } } } } },
                  },
                },
              },
            },
          },
        },
      });
      const tz = cls?.sectionTimetable.section.grade.campus.school.timezone ?? DEFAULT_TIMEZONE;
      timezoneCache.set(key, tz);
      return tz;
    });
  }

  /** The whole published-plan weekly grid for a section (no date overlay). */
  loadSectionWeek(sectionId: string, date: Date): Promise<LoadedClass[]> {
    return this.run(async (tx) => {
      const section = await tx.section.findFirst({
        where: { id: sectionId },
        select: { grade: { select: { campusId: true } } },
      });
      if (!section) return [];
      const planId = await this.publishedPlanId(tx, section.grade.campusId, date);
      if (!planId) return [];
      const st = await tx.sectionTimetable.findFirst({
        where: { planId, sectionId, deletedAt: null },
        include: { classes: { include: classInclude } },
      });
      return (st?.classes ?? []).map((c) =>
        this.mapClass({ ...c, sectionTimetable: { sectionId } }),
      );
    });
  }

  /** A teacher's scheduled classes for a weekday across every PUBLISHED plan. */
  loadTeacherDayClasses(teacherId: string, dayOfWeek: DayOfWeek): Promise<LoadedTeacherClass[]> {
    return this.run(async (tx) => {
      const rows = await tx.scheduledClass.findMany({
        where: {
          teacherId,
          dayOfWeek,
          sectionTimetable: { deletedAt: null, plan: { status: 'PUBLISHED', deletedAt: null } },
        },
        include: {
          ...classInclude,
          sectionTimetable: {
            select: {
              sectionId: true,
              section: {
                select: {
                  name: true,
                  grade: {
                    select: {
                      campusId: true,
                      nameEn: true,
                      nameAr: true,
                      campus: { select: { school: { select: { timezone: true } } } },
                    },
                  },
                },
              },
            },
          },
        },
      });
      return rows.map((c) => ({
        ...this.mapClass({ ...c, sectionTimetable: { sectionId: c.sectionTimetable.sectionId } }),
        sectionName: c.sectionTimetable.section.name,
        gradeNameEn: c.sectionTimetable.section.grade.nameEn,
        gradeNameAr: c.sectionTimetable.section.grade.nameAr,
        campusId: c.sectionTimetable.section.grade.campusId,
        schoolTimezone: c.sectionTimetable.section.grade.campus.school.timezone,
      }));
    });
  }

  /** Exceptions for a set of sections on a date (used to overlay the teacher's day). */
  loadExceptionsForSections(
    sectionIds: string[],
    date: Date,
  ): Promise<Map<string, LoadedException[]>> {
    return this.run(async (tx) => {
      const rows = await tx.scheduleException.findMany({
        where: {
          date: atUtcMidnight(date),
          OR: [{ sectionId: { in: sectionIds } }, { sectionId: null }],
        },
        include: {
          subject: { select: { nameEn: true } },
          teacher: { select: { firstNameEn: true, lastNameEn: true } },
          substitute: { select: { firstNameEn: true, lastNameEn: true } },
        },
      });
      const map = new Map<string, LoadedException[]>();
      for (const e of rows) {
        const mapped: LoadedException = {
          classNumber: e.classNumber,
          type: e.type,
          subjectName: e.subject?.nameEn ?? null,
          teacherId: e.teacherId,
          teacherName: fullName(e.teacher),
          substituteTeacherId: e.substituteTeacherId,
          substituteTeacherName: fullName(e.substitute),
          note: e.note,
        };
        // A school-wide exception (null section) applies to every section in scope.
        const targets = e.sectionId ? [e.sectionId] : sectionIds;
        for (const sid of targets) map.set(sid, [...(map.get(sid) ?? []), mapped]);
      }
      return map;
    });
  }

  ramadanConfig(campusId: string): Promise<RamadanConfig | null> {
    return this.run(async (tx) => {
      const row = await tx.timetableConfig.findFirst({ where: { campusId } });
      return row
        ? {
            ramadanModeEnabled: row.ramadanModeEnabled,
            ramadanStartDate: row.ramadanStartDate,
            ramadanEndDate: row.ramadanEndDate,
          }
        : null;
    });
  }

  /** Ramadan configs for many campuses in one query (used by the multi-section teacher day). */
  ramadanConfigs(campusIds: string[]): Promise<Map<string, RamadanConfig>> {
    return this.run(async (tx) => {
      const rows = await tx.timetableConfig.findMany({ where: { campusId: { in: campusIds } } });
      return new Map(
        rows.map((row) => [
          row.campusId,
          {
            ramadanModeEnabled: row.ramadanModeEnabled,
            ramadanStartDate: row.ramadanStartDate,
            ramadanEndDate: row.ramadanEndDate,
          },
        ]),
      );
    });
  }

  /** Resolve the Teacher profile for the acting user (throws-free; null if not a teacher). */
  teacherIdForUser(userId: string): Promise<string | null> {
    return this.run(async (tx) => {
      const t = await tx.teacher.findFirst({
        where: { userId, deletedAt: null },
        select: { id: true },
      });
      return t?.id ?? null;
    });
  }

  /** The current section of the Student linked to the acting user (null if not a student). */
  studentSectionForUser(userId: string): Promise<string | null> {
    return this.run(async (tx) => {
      const s = await tx.student.findFirst({
        where: { userId, deletedAt: null },
        select: { sectionId: true },
      });
      return s?.sectionId ?? null;
    });
  }

  /** Every scheduled class in a plan (all sections) — the input to conflict detection. */
  loadPlanClasses(planId: string): Promise<LoadedClass[]> {
    return this.run(async (tx) => {
      const rows = await tx.scheduledClass.findMany({
        where: { sectionTimetable: { planId, deletedAt: null } },
        include: { ...classInclude, sectionTimetable: { select: { sectionId: true } } },
        // Deterministic order so conflict output is stable across runs.
        orderBy: [{ scheduleType: 'asc' }, { dayOfWeek: 'asc' }, { classNumber: 'asc' }],
      });
      return rows.map((c) => this.mapClass(c));
    });
  }
}
