import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { BehaviorLog } from '@prisma/client';
import { BehaviorRepository } from './behavior.repository';
import { TenantContextStore } from '../../prisma/tenant-context';
import type { CreateBehaviorDto } from './behavior.dto';

@Injectable()
export class BehaviorService {
  constructor(private readonly repo: BehaviorRepository) {}

  async create(dto: CreateBehaviorDto): Promise<BehaviorLog> {
    if (!(await this.repo.studentExists(dto.studentId))) {
      throw new BadRequestException('Student not found in this tenant');
    }
    return this.repo.create({
      studentId: dto.studentId,
      type: dto.type,
      category: dto.category ?? null,
      title: dto.title,
      description: dto.description ?? null,
      points: dto.points ?? 0,
      date: new Date(dto.date),
      recordedById: TenantContextStore.get()?.actorUserId ?? null,
    });
  }

  listForStudent(studentId: string): Promise<BehaviorLog[]> {
    return this.repo.findByStudent(studentId);
  }

  async remove(id: string): Promise<void> {
    const log = await this.repo.findById(id);
    if (!log) throw new NotFoundException('Behavior log not found');
    await this.repo.delete(id);
  }
}
