import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Section } from '@prisma/client';
import { SectionRepository, type SectionWithGrade } from './section.repository';
import type { CreateSectionDto, UpdateSectionDto } from './section.dto';

@Injectable()
export class SectionService {
  constructor(private readonly repo: SectionRepository) {}

  async create(dto: CreateSectionDto): Promise<Section> {
    if (!(await this.repo.gradeExists(dto.gradeId))) {
      throw new BadRequestException('Grade not found in this tenant');
    }
    if (dto.classroomId && !(await this.repo.classroomExists(dto.classroomId))) {
      throw new BadRequestException('Classroom not found in this tenant');
    }
    return this.repo.create(dto);
  }

  list(gradeId?: string): Promise<SectionWithGrade[]> {
    return this.repo.findMany(gradeId);
  }

  async get(id: string): Promise<Section> {
    const section = await this.repo.findById(id);
    if (!section) throw new NotFoundException('Section not found');
    return section;
  }

  async update(id: string, dto: UpdateSectionDto): Promise<Section> {
    await this.get(id);
    if (dto.gradeId && !(await this.repo.gradeExists(dto.gradeId))) {
      throw new BadRequestException('Grade not found in this tenant');
    }
    if (dto.classroomId && !(await this.repo.classroomExists(dto.classroomId))) {
      throw new BadRequestException('Classroom not found in this tenant');
    }
    return this.repo.update(id, dto);
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.repo.delete(id);
  }
}
