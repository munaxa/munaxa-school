import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Area } from '@prisma/client';
import { AreaRepository, type AreaWithStats } from './area.repository';
import type { CreateAreaDto, UpdateAreaDto } from './area.dto';

@Injectable()
export class AreaService {
  constructor(private readonly repo: AreaRepository) {}

  list(filter: { active?: boolean; transportationAvailable?: boolean }): Promise<AreaWithStats[]> {
    return this.repo.list(filter);
  }

  async create(dto: CreateAreaDto): Promise<Area> {
    await this.assertRoute(dto.routeId);
    return this.repo.create({
      name: dto.name,
      ...(dto.routeId ? { routeId: dto.routeId } : {}),
      ...(dto.academicYearId ? { academicYearId: dto.academicYearId } : {}),
      ...(dto.transportFee !== undefined ? { transportFee: dto.transportFee } : {}),
      ...(dto.transportationAvailable !== undefined
        ? { transportationAvailable: dto.transportationAvailable }
        : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
      notes: dto.notes ?? null,
    });
  }

  async update(id: string, dto: UpdateAreaDto): Promise<Area> {
    const area = await this.repo.find(id);
    if (!area) throw new NotFoundException('Area not found');
    await this.assertRoute(dto.routeId);
    return this.repo.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      // Empty string clears the mapping (disconnect); a uuid sets it.
      ...(dto.routeId !== undefined ? { routeId: dto.routeId || null } : {}),
      ...(dto.academicYearId !== undefined ? { academicYearId: dto.academicYearId || null } : {}),
      ...(dto.transportFee !== undefined ? { transportFee: dto.transportFee } : {}),
      ...(dto.transportationAvailable !== undefined
        ? { transportationAvailable: dto.transportationAvailable }
        : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
    });
  }

  private async assertRoute(routeId?: string): Promise<void> {
    if (routeId && !(await this.repo.routeExists(routeId))) {
      throw new BadRequestException('Route not found in this tenant');
    }
  }
}
