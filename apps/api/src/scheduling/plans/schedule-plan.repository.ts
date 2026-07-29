import { Injectable } from '@nestjs/common';
import type { DayOfWeek, Prisma, ScheduledClass, SchedulePlan, ScheduleType } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';
import { TenantContextStore } from '../../prisma/tenant-context';

export interface NewClass {
  sectionId: string;
  scheduleType: ScheduleType;
  dayOfWeek: DayOfWeek;
  classNumber: number;
  startTime: string;
  endTime: string;
  subjectId: string;
  teacherId: string | null;
  locationId: string | null;
}

@Injectable()
export class SchedulePlanRepository extends TenantRepository {
  /** { academicYearId, campusId } for a semester (via its academic year). */
  private async semesterContext(
    tx: Prisma.TransactionClient,
    semesterId: string,
  ): Promise<{ academicYearId: string; campusId: string } | null> {
    const semester = await tx.semester.findFirst({
      where: { id: semesterId },
      select: { academicYearId: true, academicYear: { select: { campusId: true } } },
    });
    if (!semester) return null;
    return { academicYearId: semester.academicYearId, campusId: semester.academicYear.campusId };
  }

  create(semesterId: string, name: string): Promise<SchedulePlan | null> {
    return this.run(async (tx, tenantId) => {
      const ctx = await this.semesterContext(tx, semesterId);
      if (!ctx) return null;
      const plan = await tx.schedulePlan.create({
        data: {
          tenantId,
          semesterId,
          academicYearId: ctx.academicYearId,
          campusId: ctx.campusId,
          name,
          status: 'DRAFT',
          createdById: TenantContextStore.get()?.actorUserId ?? null,
        },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'schedule_plan.create',
        entityType: 'SchedulePlan',
        entityId: plan.id,
      });
      return plan;
    });
  }

  list(semesterId?: string): Promise<SchedulePlan[]> {
    return this.run((tx) =>
      tx.schedulePlan.findMany({
        where: { deletedAt: null, ...(semesterId ? { semesterId } : {}) },
        orderBy: [{ createdAt: 'desc' }],
      }),
    );
  }

  findById(id: string): Promise<SchedulePlan | null> {
    return this.run((tx) => tx.schedulePlan.findFirst({ where: { id, deletedAt: null } }));
  }

  /** Plan header + per-section class counts (the workspace overview). */
  overview(id: string) {
    return this.run(async (tx) => {
      const plan = await tx.schedulePlan.findFirst({ where: { id, deletedAt: null } });
      if (!plan) return null;
      const sections = await tx.sectionTimetable.findMany({
        where: { planId: id, deletedAt: null },
        select: {
          id: true,
          sectionId: true,
          section: { select: { name: true, grade: { select: { nameEn: true, level: true } } } },
          _count: { select: { classes: true } },
        },
      });
      return { plan, sections };
    });
  }

  rename(id: string, name: string): Promise<SchedulePlan> {
    return this.run((tx) => tx.schedulePlan.update({ where: { id }, data: { name } }));
  }

  publish(id: string): Promise<SchedulePlan> {
    return this.run(async (tx, tenantId) => {
      const plan = await tx.schedulePlan.findFirstOrThrow({ where: { id, deletedAt: null } });
      // Publishing supersedes the currently published plan in the same semester (one published at a time).
      await tx.schedulePlan.updateMany({
        where: { semesterId: plan.semesterId, status: 'PUBLISHED', id: { not: id } },
        data: { status: 'ARCHIVED', archivedAt: new Date() },
      });
      const updated = await tx.schedulePlan.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          publishedById: TenantContextStore.get()?.actorUserId ?? null,
        },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'schedule_plan.publish',
        entityType: 'SchedulePlan',
        entityId: id,
      });
      return updated;
    });
  }

  setStatus(id: string, status: 'DRAFT' | 'ARCHIVED'): Promise<SchedulePlan> {
    return this.run(async (tx, tenantId) => {
      const updated = await tx.schedulePlan.update({
        where: { id },
        data: {
          status,
          ...(status === 'ARCHIVED' ? { archivedAt: new Date() } : { archivedAt: null }),
        },
      });
      await this.writeAudit(tx, tenantId, {
        action: status === 'ARCHIVED' ? 'schedule_plan.archive' : 'schedule_plan.restore',
        entityType: 'SchedulePlan',
        entityId: id,
      });
      return updated;
    });
  }

  softDelete(id: string): Promise<SchedulePlan> {
    return this.run(async (tx, tenantId) => {
      const deleted = await tx.schedulePlan.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'schedule_plan.delete',
        entityType: 'SchedulePlan',
        entityId: id,
      });
      return deleted;
    });
  }

  /** Copy a plan's whole structure into a new DRAFT plan (same semester, or an overridden target). */
  duplicate(
    sourceId: string,
    name: string,
    target?: { semesterId: string; academicYearId: string; campusId: string },
  ): Promise<SchedulePlan | null> {
    return this.run(async (tx, tenantId) => {
      const src = await tx.schedulePlan.findFirst({
        where: { id: sourceId, deletedAt: null },
        include: {
          sectionTimetables: { where: { deletedAt: null }, include: { classes: true } },
        },
      });
      if (!src) return null;
      const plan = await tx.schedulePlan.create({
        data: {
          tenantId,
          semesterId: target?.semesterId ?? src.semesterId,
          academicYearId: target?.academicYearId ?? src.academicYearId,
          campusId: target?.campusId ?? src.campusId,
          name,
          status: 'DRAFT',
          createdById: TenantContextStore.get()?.actorUserId ?? null,
        },
      });
      for (const st of src.sectionTimetables) {
        const newSt = await tx.sectionTimetable.create({
          data: { tenantId, planId: plan.id, sectionId: st.sectionId },
        });
        if (st.classes.length > 0) {
          await tx.scheduledClass.createMany({
            data: st.classes.map((c) => ({
              tenantId,
              sectionTimetableId: newSt.id,
              scheduleType: c.scheduleType,
              dayOfWeek: c.dayOfWeek,
              classNumber: c.classNumber,
              startTime: c.startTime,
              endTime: c.endTime,
              subjectId: c.subjectId,
              teacherId: c.teacherId,
              locationId: c.locationId,
            })),
          });
        }
      }
      return plan;
    });
  }

  /** The published (else most recent) plan id for a semester — the copy-previous-semester source. */
  sourcePlanForSemester(semesterId: string): Promise<string | null> {
    return this.run(async (tx) => {
      const published = await tx.schedulePlan.findFirst({
        where: { semesterId, status: 'PUBLISHED', deletedAt: null },
        select: { id: true },
      });
      if (published) return published.id;
      const latest = await tx.schedulePlan.findFirst({
        where: { semesterId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      return latest?.id ?? null;
    });
  }

  targetContext(semesterId: string) {
    return this.run((tx) => this.semesterContext(tx, semesterId));
  }

  /** All classes for one section within a plan (any status) — the editable grid. */
  sectionClasses(planId: string, sectionId: string) {
    return this.run((tx) =>
      tx.scheduledClass.findMany({
        where: { sectionTimetable: { planId, sectionId } },
        include: {
          subject: { select: { nameEn: true, colorHex: true } },
          teacher: { select: { firstNameEn: true, lastNameEn: true } },
          location: { select: { nameEn: true } },
        },
        orderBy: [{ scheduleType: 'asc' }, { dayOfWeek: 'asc' }, { classNumber: 'asc' }],
      }),
    );
  }

  // ----- Class management (DRAFT plans) -------------------------------------

  /** Get-or-create the SectionTimetable for a (plan, section). */
  private async ensureSectionTimetable(
    tx: Prisma.TransactionClient,
    tenantId: string,
    planId: string,
    sectionId: string,
  ): Promise<string> {
    const existing = await tx.sectionTimetable.findFirst({
      where: { planId, sectionId, deletedAt: null },
      select: { id: true },
    });
    if (existing) return existing.id;
    const created = await tx.sectionTimetable.create({
      data: { tenantId, planId, sectionId },
      select: { id: true },
    });
    return created.id;
  }

  addClass(planId: string, c: NewClass): Promise<ScheduledClass> {
    return this.run(async (tx, tenantId) => {
      const stId = await this.ensureSectionTimetable(tx, tenantId, planId, c.sectionId);
      return tx.scheduledClass.create({
        data: {
          tenantId,
          sectionTimetableId: stId,
          scheduleType: c.scheduleType,
          dayOfWeek: c.dayOfWeek,
          classNumber: c.classNumber,
          startTime: c.startTime,
          endTime: c.endTime,
          subjectId: c.subjectId,
          teacherId: c.teacherId,
          locationId: c.locationId,
        },
      });
    });
  }

  /** Confirm a class belongs to the plan, then update it. */
  updateClass(
    planId: string,
    classId: string,
    data: Prisma.ScheduledClassUpdateInput,
  ): Promise<ScheduledClass | null> {
    return this.run(async (tx) => {
      const cls = await tx.scheduledClass.findFirst({
        where: { id: classId, sectionTimetable: { planId } },
        select: { id: true },
      });
      if (!cls) return null;
      return tx.scheduledClass.update({ where: { id: classId }, data });
    });
  }

  deleteClass(planId: string, classId: string): Promise<boolean> {
    return this.run(async (tx) => {
      const cls = await tx.scheduledClass.findFirst({
        where: { id: classId, sectionTimetable: { planId } },
        select: { id: true },
      });
      if (!cls) return false;
      await tx.scheduledClass.delete({ where: { id: classId } });
      return true;
    });
  }

  clearDay(
    planId: string,
    sectionId: string,
    dayOfWeek: DayOfWeek,
    scheduleType: ScheduleType,
  ): Promise<number> {
    return this.run(async (tx) => {
      const res = await tx.scheduledClass.deleteMany({
        where: { sectionTimetable: { planId, sectionId }, dayOfWeek, scheduleType },
      });
      return res.count;
    });
  }

  clearSection(planId: string, sectionId: string): Promise<number> {
    return this.run(async (tx) => {
      const res = await tx.scheduledClass.deleteMany({
        where: { sectionTimetable: { planId, sectionId } },
      });
      return res.count;
    });
  }

  bulkReplaceTeacher(planId: string, fromTeacherId: string, toTeacherId: string): Promise<number> {
    return this.run(async (tx) => {
      const res = await tx.scheduledClass.updateMany({
        where: { sectionTimetable: { planId }, teacherId: fromTeacherId },
        data: { teacherId: toTeacherId },
      });
      return res.count;
    });
  }

  bulkReplaceSubject(planId: string, fromSubjectId: string, toSubjectId: string): Promise<number> {
    return this.run(async (tx) => {
      const res = await tx.scheduledClass.updateMany({
        where: { sectionTimetable: { planId }, subjectId: fromSubjectId },
        data: { subjectId: toSubjectId },
      });
      return res.count;
    });
  }
}
