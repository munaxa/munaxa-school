import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DepartmentRepository } from './department.repository';
import type { CreateDepartmentDto, UpdateDepartmentDto } from './department.dto';

@Injectable()
export class DepartmentService {
  constructor(private readonly repo: DepartmentRepository) {}

  create(dto: CreateDepartmentDto) {
    return this.repo.create({
      name: dto.name,
      ...(dto.code !== undefined ? { code: dto.code } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.campusId !== undefined ? { campusId: dto.campusId } : {}),
      ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
      ...(dto.headEmployeeId !== undefined ? { headEmployeeId: dto.headEmployeeId } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });
  }

  list() {
    return this.repo.list();
  }

  async get(id: string) {
    const dept = await this.repo.findById(id);
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.get(id);
    const data: Prisma.DepartmentUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.campusId !== undefined)
      data.campus = dto.campusId ? { connect: { id: dto.campusId } } : { disconnect: true };
    if (dto.parentId !== undefined)
      data.parent = dto.parentId ? { connect: { id: dto.parentId } } : { disconnect: true };
    if (dto.headEmployeeId !== undefined)
      data.head = dto.headEmployeeId
        ? { connect: { id: dto.headEmployeeId } }
        : { disconnect: true };
    return this.repo.update(id, data);
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.repo.softDelete(id);
  }
}
