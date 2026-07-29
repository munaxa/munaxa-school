import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ScheduledClass, SchedulePlan } from '@prisma/client';
import { SchedulePlanRepository } from './schedule-plan.repository';
import { SchedulingService } from '../scheduling.service';
import { timeToMinutes } from '../engine/scheduling-engine';
import type {
  BulkReplaceSubjectDto,
  BulkReplaceTeacherDto,
  ClearDayDto,
  ClearSectionDto,
  CopySemesterDto,
  CreateClassDto,
  CreatePlanDto,
  DuplicatePlanDto,
  UpdateClassDto,
  UpdatePlanDto,
} from './schedule-plan.dto';

@Injectable()
export class SchedulePlanService {
  constructor(
    private readonly repo: SchedulePlanRepository,
    private readonly scheduling: SchedulingService,
  ) {}

  async create(dto: CreatePlanDto): Promise<SchedulePlan> {
    const plan = await this.repo.create(dto.semesterId, dto.name);
    if (!plan) throw new BadRequestException('Semester not found in this tenant');
    return plan;
  }

  list(semesterId?: string): Promise<SchedulePlan[]> {
    return this.repo.list(semesterId);
  }

  async get(id: string): Promise<SchedulePlan> {
    const plan = await this.repo.findById(id);
    if (!plan) throw new NotFoundException('Schedule plan not found');
    return plan;
  }

  async overview(id: string) {
    const data = await this.repo.overview(id);
    if (!data) throw new NotFoundException('Schedule plan not found');
    const validation = await this.scheduling.validatePlan(id);
    return { ...data, validation };
  }

  /** Conflicts + publish-gate for the validation panel. */
  async validate(id: string) {
    await this.get(id);
    return this.scheduling.validatePlan(id);
  }

  /** The editable class rows for one section of a plan. */
  async sectionClasses(id: string, sectionId: string) {
    await this.get(id);
    const rows = await this.repo.sectionClasses(id, sectionId);
    return rows.map((c) => ({
      id: c.id,
      scheduleType: c.scheduleType,
      dayOfWeek: c.dayOfWeek,
      classNumber: c.classNumber,
      startTime: c.startTime,
      endTime: c.endTime,
      subjectId: c.subjectId,
      subjectName: c.subject.nameEn,
      subjectColor: c.subject.colorHex,
      teacherId: c.teacherId,
      teacherName: c.teacher ? `${c.teacher.firstNameEn} ${c.teacher.lastNameEn}`.trim() : null,
      locationId: c.locationId,
      locationName: c.location?.nameEn ?? null,
    }));
  }

  async update(id: string, dto: UpdatePlanDto): Promise<SchedulePlan> {
    const plan = await this.assertDraft(id);
    if (dto.name === undefined) return plan;
    return this.repo.rename(id, dto.name);
  }

  /** Publish is the ONLY path to a live schedule — it fails while any conflict exists. */
  async publish(id: string): Promise<SchedulePlan> {
    const plan = await this.get(id);
    if (plan.status !== 'DRAFT') {
      throw new BadRequestException('Only a draft plan can be published');
    }
    const { conflicts, canPublish } = await this.scheduling.validatePlan(id);
    if (!canPublish) {
      throw new ConflictException({
        message: 'Resolve all conflicts before publishing',
        conflicts: conflicts.filter((c) => c.severity === 'ERROR'),
      });
    }
    return this.repo.publish(id);
  }

  async archive(id: string): Promise<SchedulePlan> {
    const plan = await this.get(id);
    if (plan.status === 'ARCHIVED') return plan;
    return this.repo.setStatus(id, 'ARCHIVED');
  }

  async restore(id: string): Promise<SchedulePlan> {
    const plan = await this.get(id);
    if (plan.status !== 'ARCHIVED') {
      throw new BadRequestException('Only an archived plan can be restored');
    }
    return this.repo.setStatus(id, 'DRAFT');
  }

  async remove(id: string): Promise<void> {
    const plan = await this.get(id);
    if (plan.status === 'PUBLISHED') {
      throw new BadRequestException('A published plan cannot be deleted; archive it first');
    }
    await this.repo.softDelete(id);
  }

  async duplicate(id: string, dto: DuplicatePlanDto): Promise<SchedulePlan> {
    await this.get(id);
    const copy = await this.repo.duplicate(id, dto.name);
    if (!copy) throw new NotFoundException('Schedule plan not found');
    return copy;
  }

  async copySemester(dto: CopySemesterDto): Promise<SchedulePlan> {
    const sourcePlanId = await this.repo.sourcePlanForSemester(dto.sourceSemesterId);
    if (!sourcePlanId)
      throw new BadRequestException('Source semester has no schedule plan to copy');
    const target = await this.repo.targetContext(dto.targetSemesterId);
    if (!target) throw new BadRequestException('Target semester not found in this tenant');
    const copy = await this.repo.duplicate(sourcePlanId, dto.name, {
      semesterId: dto.targetSemesterId,
      ...target,
    });
    if (!copy) throw new BadRequestException('Could not copy the source plan');
    return copy;
  }

  // ----- Class management (DRAFT only) --------------------------------------

  async addClass(planId: string, dto: CreateClassDto): Promise<ScheduledClass> {
    await this.assertDraft(planId);
    this.assertTimeOrder(dto.startTime, dto.endTime);
    return this.repo.addClass(planId, {
      sectionId: dto.sectionId,
      scheduleType: dto.scheduleType ?? 'REGULAR',
      dayOfWeek: dto.dayOfWeek,
      classNumber: dto.classNumber,
      startTime: dto.startTime,
      endTime: dto.endTime,
      subjectId: dto.subjectId,
      teacherId: dto.teacherId ?? null,
      locationId: dto.locationId ?? null,
    });
  }

  async updateClass(planId: string, classId: string, dto: UpdateClassDto): Promise<ScheduledClass> {
    await this.assertDraft(planId);
    if (dto.startTime && dto.endTime) this.assertTimeOrder(dto.startTime, dto.endTime);
    const updated = await this.repo.updateClass(planId, classId, {
      ...(dto.scheduleType !== undefined ? { scheduleType: dto.scheduleType } : {}),
      ...(dto.dayOfWeek !== undefined ? { dayOfWeek: dto.dayOfWeek } : {}),
      ...(dto.classNumber !== undefined ? { classNumber: dto.classNumber } : {}),
      ...(dto.startTime !== undefined ? { startTime: dto.startTime } : {}),
      ...(dto.endTime !== undefined ? { endTime: dto.endTime } : {}),
      ...(dto.subjectId !== undefined ? { subject: { connect: { id: dto.subjectId } } } : {}),
      ...(dto.teacherId !== undefined
        ? { teacher: dto.teacherId ? { connect: { id: dto.teacherId } } : { disconnect: true } }
        : {}),
      ...(dto.locationId !== undefined
        ? { location: dto.locationId ? { connect: { id: dto.locationId } } : { disconnect: true } }
        : {}),
    });
    if (!updated) throw new NotFoundException('Class not found in this plan');
    return updated;
  }

  async deleteClass(planId: string, classId: string): Promise<void> {
    await this.assertDraft(planId);
    if (!(await this.repo.deleteClass(planId, classId))) {
      throw new NotFoundException('Class not found in this plan');
    }
  }

  async clearDay(planId: string, dto: ClearDayDto): Promise<{ removed: number }> {
    await this.assertDraft(planId);
    const removed = await this.repo.clearDay(
      planId,
      dto.sectionId,
      dto.dayOfWeek,
      dto.scheduleType ?? 'REGULAR',
    );
    return { removed };
  }

  async clearSection(planId: string, dto: ClearSectionDto): Promise<{ removed: number }> {
    await this.assertDraft(planId);
    return { removed: await this.repo.clearSection(planId, dto.sectionId) };
  }

  async bulkReplaceTeacher(
    planId: string,
    dto: BulkReplaceTeacherDto,
  ): Promise<{ updated: number }> {
    await this.assertDraft(planId);
    return {
      updated: await this.repo.bulkReplaceTeacher(planId, dto.fromTeacherId, dto.toTeacherId),
    };
  }

  async bulkReplaceSubject(
    planId: string,
    dto: BulkReplaceSubjectDto,
  ): Promise<{ updated: number }> {
    await this.assertDraft(planId);
    return {
      updated: await this.repo.bulkReplaceSubject(planId, dto.fromSubjectId, dto.toSubjectId),
    };
  }

  // ----- guards -------------------------------------------------------------

  private async assertDraft(id: string): Promise<SchedulePlan> {
    const plan = await this.get(id);
    if (plan.status !== 'DRAFT') {
      throw new BadRequestException(
        'Only draft plans can be edited; published plans are read-only',
      );
    }
    return plan;
  }

  private assertTimeOrder(start: string, end: string): void {
    if (timeToMinutes(start) >= timeToMinutes(end)) {
      throw new BadRequestException('startTime must be before endTime');
    }
  }
}
