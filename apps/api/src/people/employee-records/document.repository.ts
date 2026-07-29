import { Injectable } from '@nestjs/common';
import type { EmployeeDocument, Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';
import { TenantContextStore } from '../../prisma/tenant-context';

@Injectable()
export class EmployeeDocumentRepository extends TenantRepository {
  employeeExists(employeeId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.employee.findFirst({ where: { id: employeeId, deletedAt: null } })) !== null,
    );
  }

  create(
    employeeId: string,
    data: Omit<Prisma.EmployeeDocumentUncheckedCreateInput, 'tenantId' | 'employeeId'>,
  ): Promise<EmployeeDocument> {
    const uploadedById = TenantContextStore.get()?.actorUserId ?? null;
    return this.run(async (tx, tenantId) => {
      const doc = await tx.employeeDocument.create({
        data: { ...data, tenantId, employeeId, uploadedById },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'employee_document.create',
        entityType: 'EmployeeDocument',
        entityId: doc.id,
        metadata: { employeeId, type: doc.type, version: doc.version },
      });
      return doc;
    });
  }

  listForEmployee(employeeId: string): Promise<EmployeeDocument[]> {
    return this.run((tx) =>
      tx.employeeDocument.findMany({
        where: { employeeId, deletedAt: null },
        orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
      }),
    );
  }

  findById(id: string): Promise<EmployeeDocument | null> {
    return this.run((tx) => tx.employeeDocument.findFirst({ where: { id, deletedAt: null } }));
  }

  softDelete(id: string): Promise<EmployeeDocument> {
    return this.run(async (tx, tenantId) => {
      const doc = await tx.employeeDocument.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'employee_document.delete',
        entityType: 'EmployeeDocument',
        entityId: id,
      });
      return doc;
    });
  }
}
