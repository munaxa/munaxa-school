import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DriverRepository } from './driver.repository';
import type {
  CreateInfractionDto,
  UpdateInfractionDto,
  UpsertDriverProfileDto,
} from './driver.dto';

const d = (v?: string) => (v ? new Date(v) : undefined);

@Injectable()
export class DriverService {
  constructor(private readonly repo: DriverRepository) {}

  listDrivers() {
    return this.repo.listDrivers();
  }

  listCandidates() {
    return this.repo.listDriverCandidates();
  }

  async getProfile(employeeId: string) {
    const profile = await this.repo.findProfileByEmployee(employeeId);
    if (!profile) throw new NotFoundException('Driver profile not found');
    return profile;
  }

  async upsertProfile(employeeId: string, dto: UpsertDriverProfileDto) {
    if (!(await this.repo.employeeExists(employeeId))) {
      throw new NotFoundException('Employee not found');
    }
    return this.repo.upsert(employeeId, {
      ...(dto.licenseNumber !== undefined ? { licenseNumber: dto.licenseNumber } : {}),
      ...(dto.licenseClass !== undefined ? { licenseClass: dto.licenseClass } : {}),
      ...(dto.licenseExpiry !== undefined ? { licenseExpiry: d(dto.licenseExpiry) } : {}),
      ...(dto.medicalCertExpiry !== undefined
        ? { medicalCertExpiry: d(dto.medicalCertExpiry) }
        : {}),
      ...(dto.medicalNotes !== undefined ? { medicalNotes: dto.medicalNotes } : {}),
      ...(dto.performanceRating !== undefined ? { performanceRating: dto.performanceRating } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    });
  }

  async removeProfile(employeeId: string) {
    const profile = await this.getProfile(employeeId);
    await this.repo.softDeleteProfile(profile.id);
  }

  // ----- Infractions --------------------------------------------------------
  async addInfraction(employeeId: string, dto: CreateInfractionDto) {
    const profile = await this.getProfile(employeeId);
    return this.repo.createInfraction(profile.id, {
      date: new Date(dto.date),
      type: dto.type,
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.severity !== undefined ? { severity: dto.severity } : {}),
      ...(dto.points !== undefined ? { points: dto.points } : {}),
    });
  }

  async updateInfraction(employeeId: string, id: string, dto: UpdateInfractionDto) {
    const profile = await this.getProfile(employeeId);
    const infraction = await this.repo.findInfraction(id);
    if (!infraction || infraction.driverProfileId !== profile.id) {
      throw new NotFoundException('Infraction not found');
    }
    const data: Prisma.DriverInfractionUncheckedUpdateInput = {};
    if (dto.date !== undefined) data.date = new Date(dto.date);
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.severity !== undefined) data.severity = dto.severity;
    if (dto.points !== undefined) data.points = dto.points;
    return this.repo.updateInfraction(id, data);
  }

  async removeInfraction(employeeId: string, id: string) {
    const profile = await this.getProfile(employeeId);
    const infraction = await this.repo.findInfraction(id);
    if (!infraction || infraction.driverProfileId !== profile.id) {
      throw new NotFoundException('Infraction not found');
    }
    await this.repo.deleteInfraction(id);
  }
}
