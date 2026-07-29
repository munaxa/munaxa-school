import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Campus } from '@prisma/client';
import { CampusRepository } from './campus.repository';
import type { CreateCampusDto, UpdateCampusDto } from './campus.dto';

@Injectable()
export class CampusService {
  constructor(private readonly repo: CampusRepository) {}

  async create(dto: CreateCampusDto): Promise<Campus> {
    if (!(await this.repo.schoolExists(dto.schoolId))) {
      throw new BadRequestException('School not found in this tenant');
    }
    return this.repo.create(dto);
  }

  list(schoolId?: string): Promise<Campus[]> {
    return this.repo.findMany(schoolId);
  }

  async get(id: string): Promise<Campus> {
    const campus = await this.repo.findById(id);
    if (!campus) throw new NotFoundException('Campus not found');
    return campus;
  }

  async update(id: string, dto: UpdateCampusDto): Promise<Campus> {
    await this.get(id);
    if (dto.schoolId && !(await this.repo.schoolExists(dto.schoolId))) {
      throw new BadRequestException('School not found in this tenant');
    }
    return this.repo.update(id, dto);
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.repo.softDelete(id);
  }
}
