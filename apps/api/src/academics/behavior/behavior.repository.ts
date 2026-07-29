import { Injectable } from '@nestjs/common';
import type { BehaviorLog, Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

@Injectable()
export class BehaviorRepository extends TenantRepository {
  create(data: Omit<Prisma.BehaviorLogUncheckedCreateInput, 'tenantId'>): Promise<BehaviorLog> {
    return this.run((tx, tenantId) => tx.behaviorLog.create({ data: { ...data, tenantId } }));
  }

  findByStudent(studentId: string): Promise<BehaviorLog[]> {
    return this.run((tx) =>
      tx.behaviorLog.findMany({ where: { studentId }, orderBy: { date: 'desc' } }),
    );
  }

  findById(id: string): Promise<BehaviorLog | null> {
    return this.run((tx) => tx.behaviorLog.findFirst({ where: { id } }));
  }

  delete(id: string): Promise<BehaviorLog> {
    return this.run((tx) => tx.behaviorLog.delete({ where: { id } }));
  }

  studentExists(studentId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.student.findFirst({ where: { id: studentId, deletedAt: null } })) !== null,
    );
  }
}
