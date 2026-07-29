import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PositionRepository } from './position.repository';
import type { CreatePositionDto, UpdatePositionDto } from './position.dto';

@Injectable()
export class PositionService {
  constructor(private readonly repo: PositionRepository) {}

  create(dto: CreatePositionDto) {
    return this.repo.create({
      title: dto.title,
      ...(dto.code !== undefined ? { code: dto.code } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
      ...(dto.budgetedHeadcount !== undefined ? { budgetedHeadcount: dto.budgetedHeadcount } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });
  }

  list() {
    return this.repo.list();
  }

  async get(id: string) {
    const position = await this.repo.findById(id);
    if (!position) throw new NotFoundException('Position not found');
    return position;
  }

  async update(id: string, dto: UpdatePositionDto) {
    await this.get(id);
    const data: Prisma.PositionUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.budgetedHeadcount !== undefined) data.budgetedHeadcount = dto.budgetedHeadcount;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.departmentId !== undefined)
      data.department = dto.departmentId
        ? { connect: { id: dto.departmentId } }
        : { disconnect: true };
    return this.repo.update(id, data);
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.repo.softDelete(id);
  }
}
