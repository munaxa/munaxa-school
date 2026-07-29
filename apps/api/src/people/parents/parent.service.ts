import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Parent } from '@prisma/client';
import { ParentRepository } from './parent.repository';
import type { CreateParentDto, UpdateParentDto } from './parent.dto';

@Injectable()
export class ParentService {
  constructor(private readonly repo: ParentRepository) {}

  async create(dto: CreateParentDto): Promise<Parent> {
    // Mobile is the de-duplication key — point staff at the existing record instead of duplicating.
    if (dto.phone && (await this.repo.findByPhone(dto.phone))) {
      throw new ConflictException('A parent with this mobile number already exists');
    }
    return this.repo.create(dto);
  }

  list(studentId?: string): Promise<Parent[]> {
    return studentId ? this.repo.findByStudent(studentId) : this.repo.findMany();
  }

  async get(id: string): Promise<Parent> {
    const parent = await this.repo.findById(id);
    if (!parent) throw new NotFoundException('Parent not found');
    return parent;
  }

  async update(id: string, dto: UpdateParentDto): Promise<Parent> {
    await this.get(id);
    if (dto.phone) {
      const holder = await this.repo.findByPhone(dto.phone);
      if (holder && holder.id !== id) {
        throw new ConflictException('Another parent already uses this mobile number');
      }
    }
    return this.repo.update(id, dto);
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    // A guardian still linked to a student cannot be deleted — the student would be left without a
    // guardian. Staff must transfer/reassign the student(s) to another guardian first.
    const linked = await this.repo.countActiveStudents(id);
    if (linked > 0) {
      throw new ConflictException(
        `This parent is the guardian of ${linked} student(s). Reassign the student(s) to another guardian before deleting this parent.`,
      );
    }
    await this.repo.softDelete(id);
  }
}
