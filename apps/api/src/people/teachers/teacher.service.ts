import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Teacher, TeacherSection } from '@prisma/client';
import { TeacherRepository } from './teacher.repository';
import type { AssignSectionDto, CreateTeacherDto, UpdateTeacherDto } from './teacher.dto';

@Injectable()
export class TeacherService {
  constructor(private readonly repo: TeacherRepository) {}

  create(dto: CreateTeacherDto): Promise<Teacher> {
    return this.repo.create(dto);
  }

  list(): Promise<Teacher[]> {
    return this.repo.findMany();
  }

  async get(id: string): Promise<Teacher> {
    const teacher = await this.repo.findById(id);
    if (!teacher) throw new NotFoundException('Teacher not found');
    return teacher;
  }

  async update(id: string, dto: UpdateTeacherDto): Promise<Teacher> {
    await this.get(id);
    return this.repo.update(id, dto);
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.repo.softDelete(id);
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
