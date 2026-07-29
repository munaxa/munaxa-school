import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ClinicVisit, StudentMedicalRecord } from '@prisma/client';
import { ClinicRepository } from './clinic.repository';
import type { CreateClinicVisitDto, UpsertMedicalRecordDto } from './clinic.dto';

@Injectable()
export class ClinicService {
  constructor(private readonly repo: ClinicRepository) {}

  async createVisit(dto: CreateClinicVisitDto): Promise<ClinicVisit> {
    if (!(await this.repo.studentExists(dto.studentId))) {
      throw new BadRequestException('Student not found in this tenant');
    }
    return this.repo.createVisit({
      studentId: dto.studentId,
      reason: dto.reason,
      symptoms: dto.symptoms ?? null,
      treatment: dto.treatment ?? null,
      temperature: dto.temperature ?? null,
      outcome: dto.outcome ?? 'RESOLVED',
    });
  }

  listVisits(studentId?: string): Promise<ClinicVisit[]> {
    return this.repo.listVisits(studentId);
  }

  async getRecord(studentId: string): Promise<StudentMedicalRecord | null> {
    return this.repo.getRecord(studentId);
  }

  async upsertRecord(
    studentId: string,
    dto: UpsertMedicalRecordDto,
  ): Promise<StudentMedicalRecord> {
    if (!(await this.repo.studentExists(studentId))) {
      throw new NotFoundException('Student not found');
    }
    return this.repo.upsertRecord(studentId, {
      bloodType: dto.bloodType ?? null,
      allergies: dto.allergies ?? null,
      chronicConditions: dto.chronicConditions ?? null,
      medications: dto.medications ?? null,
      emergencyContact: dto.emergencyContact ?? null,
      notes: dto.notes ?? null,
    });
  }
}
