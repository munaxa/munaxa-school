import { Injectable, NotFoundException } from '@nestjs/common';
import type { ScheduleException } from '@prisma/client';
import { ScheduleExceptionRepository } from './schedule-exception.repository';
import type { CreateExceptionDto } from './schedule-exception.dto';

/** Date-specific overrides of the published schedule (cancellation / substitution / replacement /
 *  holiday). They overlay resolution for a single date and never edit the master plan. */
@Injectable()
export class ScheduleExceptionService {
  constructor(private readonly repo: ScheduleExceptionRepository) {}

  create(dto: CreateExceptionDto): Promise<ScheduleException> {
    return this.repo.create({
      date: new Date(dto.date),
      sectionId: dto.sectionId ?? null,
      classNumber: dto.classNumber ?? null,
      type: dto.type,
      subjectId: dto.subjectId ?? null,
      teacherId: dto.teacherId ?? null,
      substituteTeacherId: dto.substituteTeacherId ?? null,
      locationId: dto.locationId ?? null,
      note: dto.note ?? null,
    });
  }

  list(sectionId?: string, date?: string): Promise<ScheduleException[]> {
    return this.repo.findMany({ sectionId, date: date ? new Date(date) : undefined });
  }

  async remove(id: string): Promise<void> {
    if (!(await this.repo.findById(id)))
      throw new NotFoundException('Schedule exception not found');
    await this.repo.delete(id);
  }
}
