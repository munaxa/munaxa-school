import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Subject } from '@prisma/client';
import { SubjectRepository } from './subject.repository';
import type { CreateSubjectDto, UpdateSubjectDto } from './subject.dto';

@Injectable()
export class SubjectService {
  constructor(private readonly repo: SubjectRepository) {}

  create(dto: CreateSubjectDto): Promise<Subject> {
    return this.repo.create({
      nameEn: dto.nameEn,
      nameAr: dto.nameAr,
      code: dto.code ?? null,
      ...(dto.colorHex ? { colorHex: dto.colorHex } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });
  }

  list(includeInactive = false): Promise<Subject[]> {
    return this.repo.findMany(includeInactive);
  }

  async get(id: string): Promise<Subject> {
    const subject = await this.repo.findById(id);
    if (!subject) throw new NotFoundException('Subject not found');
    return subject;
  }

  async update(id: string, dto: UpdateSubjectDto): Promise<Subject> {
    await this.get(id);
    return this.repo.update(id, {
      ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn } : {}),
      ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr } : {}),
      ...(dto.code !== undefined ? { code: dto.code } : {}),
      ...(dto.colorHex !== undefined ? { colorHex: dto.colorHex } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    if ((await this.repo.usageCount(id)) > 0) {
      throw new BadRequestException('Subject is used by scheduled classes and cannot be deleted');
    }
    await this.repo.softDelete(id);
  }
}
