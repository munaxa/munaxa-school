import { Injectable, NotFoundException } from '@nestjs/common';
import type { SpecialLocation } from '@prisma/client';
import { LocationRepository } from './location.repository';
import type { CreateLocationDto, UpdateLocationDto } from './location.dto';

@Injectable()
export class LocationService {
  constructor(private readonly repo: LocationRepository) {}

  create(dto: CreateLocationDto): Promise<SpecialLocation> {
    return this.repo.create({
      campusId: dto.campusId,
      nameEn: dto.nameEn,
      nameAr: dto.nameAr,
      ...(dto.kind ? { kind: dto.kind } : {}),
      ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
    });
  }

  list(campusId?: string): Promise<SpecialLocation[]> {
    return this.repo.findMany(campusId);
  }

  async get(id: string): Promise<SpecialLocation> {
    const location = await this.repo.findById(id);
    if (!location) throw new NotFoundException('Location not found');
    return location;
  }

  async update(id: string, dto: UpdateLocationDto): Promise<SpecialLocation> {
    await this.get(id);
    return this.repo.update(id, {
      ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn } : {}),
      ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr } : {}),
      ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
      ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
    });
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.repo.softDelete(id);
  }
}
