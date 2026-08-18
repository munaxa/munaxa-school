import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { TeacherSection } from '@prisma/client';
import { TeacherRepository, type TeacherWithSubjects } from './teacher.repository';
import type { AssignSectionDto, UpdateTeacherDto } from './teacher.dto';

@Injectable()
export class TeacherService {
  constructor(private readonly repo: TeacherRepository) {}

  /**
   * Teaching staff are not created here. A teacher is an employee first — HR opens the teaching
   * facet on the employee record — so this service only reads and refines what HR created.
   */
  list(): Promise<TeacherWithSubjects[]> {
    return this.repo.findMany();
  }

  async get(id: string): Promise<TeacherWithSubjects> {
    const teacher = await this.repo.findById(id);
    if (!teacher) throw new NotFoundException('Teacher not found');
    return teacher;
  }

  async update(id: string, dto: UpdateTeacherDto): Promise<TeacherWithSubjects> {
    await this.get(id);
    if (dto.subjectIds) await this.setSubjects(id, dto.subjectIds);
    return this.repo.update(id, {
      ...(dto.specialization !== undefined ? { specialization: dto.specialization } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    });
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.repo.softDelete(id);
  }

  /** Replace the subjects a teacher instructs, rejecting ids from outside this school. */
  private async setSubjects(teacherId: string, subjectIds: string[]): Promise<void> {
    const wanted = [...new Set(subjectIds)];
    const live = await this.repo.liveSubjectIds(wanted);
    if (live.length !== wanted.length) {
      throw new BadRequestException('One or more subjects were not found in this school');
    }
    await this.repo.setSubjects(teacherId, live);
  }

  // ----- Section assignment ------------------------------------------------
  async assignSection(teacherId: string, dto: AssignSectionDto): Promise<TeacherSection> {
    await this.get(teacherId);
    if (!(await this.repo.sectionExists(dto.sectionId))) {
      throw new BadRequestException('Section not found in this tenant');
    }
    const subject = dto.subject ?? null;
    if (await this.repo.assignmentExists(teacherId, dto.sectionId, subject)) {
      throw new ConflictException('Teacher is already assigned to this section/subject');
    }
    return this.repo.assignSection(teacherId, dto.sectionId, subject);
  }

  async unassign(teacherId: string, assignmentId: string): Promise<void> {
    await this.get(teacherId);
    await this.repo.unassign(assignmentId);
  }

  async listSections(teacherId: string): Promise<TeacherSection[]> {
    await this.get(teacherId);
    return this.repo.listSections(teacherId);
  }
}
