import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Classroom } from '@prisma/client';
import { ClassroomRepository } from './classroom.repository';
import type { CreateClassroomDto, UpdateClassroomDto } from './classroom.dto';

@Injectable()
export class ClassroomService {
  constructor(private readonly repo: ClassroomRepository) {}

  async create(dto: CreateClassroomDto): Promise<Classroom> {
    if (!(await this.repo.campusExists(dto.campusId))) {
      throw new BadRequestException('Campus not found in this tenant');
    }
    return this.repo.create(dto);
  }

  list(campusId?: string): Promise<Classroom[]> {
    return this.repo.findMany(campusId);
  }

  async get(id: string): Promise<Classroom> {
    const classroom = await this.repo.findById(id);
    if (!classroom) throw new NotFoundException('Classroom not found');
    return classroom;
  }

  async update(id: string, dto: UpdateClassroomDto): Promise<Classroom> {
    await this.get(id);
    // Re-validate a reassigned campusId so a PATCH cannot orphan the classroom (parity with create).
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
