import { Injectable } from '@nestjs/common';
import type { ClinicVisit, Prisma, StudentMedicalRecord } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';
import { TenantContextStore } from '../../prisma/tenant-context';

@Injectable()
export class ClinicRepository extends TenantRepository {
  createVisit(
    data: Omit<Prisma.ClinicVisitUncheckedCreateInput, 'tenantId' | 'recordedById'>,
  ): Promise<ClinicVisit> {
    return this.run((tx, tenantId) =>
      tx.clinicVisit.create({
        data: { ...data, tenantId, recordedById: TenantContextStore.get()?.actorUserId ?? null },
      }),
    );
  }

  listVisits(studentId?: string): Promise<ClinicVisit[]> {
    return this.run((tx) =>
      tx.clinicVisit.findMany({
        where: { ...(studentId ? { studentId } : {}) },
        orderBy: { visitedAt: 'desc' },
        take: 500,
      }),
    );
  }

  getRecord(studentId: string): Promise<StudentMedicalRecord | null> {
    return this.run((tx) => tx.studentMedicalRecord.findFirst({ where: { studentId } }));
  }

  upsertRecord(
    studentId: string,
    data: Omit<Prisma.StudentMedicalRecordUncheckedCreateInput, 'tenantId' | 'studentId'>,
  ): Promise<StudentMedicalRecord> {
    return this.run(async (tx, tenantId) => {
      const existing = await tx.studentMedicalRecord.findFirst({ where: { studentId } });
      if (existing) {
        return tx.studentMedicalRecord.update({ where: { id: existing.id }, data });
      }
      return tx.studentMedicalRecord.create({ data: { ...data, tenantId, studentId } });
    });
  }

  studentExists(studentId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.student.findFirst({ where: { id: studentId, deletedAt: null } })) !== null,
    );
  }
}
