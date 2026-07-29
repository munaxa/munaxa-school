import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Grade } from '@prisma/client';
import { GradeRepository } from './grade.repository';
import type { CreateGradeDto, UpdateGradeDto } from './grade.dto';

@Injectable()
export class GradeService {
  constructor(private readonly repo: GradeRepository) {}

  async create(dto: CreateGradeDto): Promise<Grade> {
    if (!(await this.repo.campusExists(dto.campusId))) {
      throw new BadRequestException('Campus not found in this tenant');
    }
    return this.repo.create(dto);
  }

  list(campusId?: string): Promise<Grade[]> {
    return this.repo.findMany(campusId);
  }

  async get(id: string): Promise<Grade> {
    const grade = await this.repo.findById(id);
    if (!grade) throw new NotFoundException('Grade not found');
    return grade;
  }

  async update(id: string, dto: UpdateGradeDto): Promise<Grade> {
    await this.get(id);
    // A reassigned campusId must be re-validated, exactly as on create — otherwise a PATCH can
    // orphan the grade against a non-existent campus (create validates; update previously did not).
    if (dto.campusId && !(await this.repo.campusExists(dto.campusId))) {
      throw new BadRequestException('Campus not found in this tenant');
    }
    return this.repo.update(id, dto);
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.repo.delete(id);
  }
}
