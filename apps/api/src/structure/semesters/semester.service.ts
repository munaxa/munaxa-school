import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Semester } from '@prisma/client';
import { SemesterRepository } from './semester.repository';
import type { CreateSemesterDto, UpdateSemesterDto } from './semester.dto';

@Injectable()
export class SemesterService {
  constructor(private readonly repo: SemesterRepository) {}

  async create(dto: CreateSemesterDto): Promise<Semester> {
    if (!(await this.repo.academicYearExists(dto.academicYearId))) {
      throw new BadRequestException('Academic year not found in this tenant');
    }
    if (new Date(dto.startDate) >= new Date(dto.endDate)) {
      throw new BadRequestException('startDate must be before endDate');
    }
    return this.repo.create({
      academicYearId: dto.academicYearId,
      name: dto.name,
      sequence: dto.sequence,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
    });
  }

  list(academicYearId?: string): Promise<Semester[]> {
    return this.repo.findMany(academicYearId);
  }

  async get(id: string): Promise<Semester> {
    const semester = await this.repo.findById(id);
    if (!semester) throw new NotFoundException('Semester not found');
    return semester;
  }

  async update(id: string, dto: UpdateSemesterDto): Promise<Semester> {
    await this.get(id);
    return this.repo.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.sequence !== undefined ? { sequence: dto.sequence } : {}),
      ...(dto.startDate ? { startDate: new Date(dto.startDate) } : {}),
      ...(dto.endDate ? { endDate: new Date(dto.endDate) } : {}),
    });
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.repo.delete(id);
  }
}
