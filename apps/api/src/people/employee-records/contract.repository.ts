import { Injectable } from '@nestjs/common';
import { ContractStatus, type EmploymentContract, type Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';
import { TenantContextStore } from '../../prisma/tenant-context';

const INCLUDE = {
  signedDocument: { select: { id: true, fileName: true, title: true } },
} satisfies Prisma.EmploymentContractInclude;

export type ContractView = Prisma.EmploymentContractGetPayload<{ include: typeof INCLUDE }>;

@Injectable()
export class ContractRepository extends TenantRepository {
  /** Confirm an employee exists (and is live) in the current tenant. */
  employeeExists(employeeId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.employee.findFirst({ where: { id: employeeId, deletedAt: null } })) !== null,
    );
  }

  create(
    employeeId: string,
    data: Omit<Prisma.EmploymentContractUncheckedCreateInput, 'tenantId' | 'employeeId'>,
  ): Promise<ContractView> {
    const actorUserId = TenantContextStore.get()?.actorUserId ?? null;
    return this.run(async (tx, tenantId) => {
      const contract = await tx.employmentContract.create({
        data: { ...data, tenantId, employeeId, createdById: actorUserId, updatedById: actorUserId },
        include: INCLUDE,
      });
      await this.writeAudit(tx, tenantId, {
        action: 'employment_contract.create',
        entityType: 'EmploymentContract',
        entityId: contract.id,
        metadata: { employeeId, status: contract.status },
      });
      return contract;
    });
  }

  listForEmployee(employeeId: string): Promise<ContractView[]> {
    return this.run((tx) =>
      tx.employmentContract.findMany({
        where: { employeeId, deletedAt: null },
        include: INCLUDE,
        orderBy: { startDate: 'desc' },
      }),
    );
  }

  findById(id: string): Promise<ContractView | null> {
    return this.run((tx) =>
      tx.employmentContract.findFirst({ where: { id, deletedAt: null }, include: INCLUDE }),
    );
  }

  update(id: string, data: Prisma.EmploymentContractUncheckedUpdateInput): Promise<ContractView> {
    const actorUserId = TenantContextStore.get()?.actorUserId ?? null;
    return this.run(async (tx, tenantId) => {
      const contract = await tx.employmentContract.update({
        where: { id },
        data: { ...data, updatedById: actorUserId },
        include: INCLUDE,
      });
      await this.writeAudit(tx, tenantId, {
        action: 'employment_contract.update',
        entityType: 'EmploymentContract',
        entityId: id,
      });
      return contract;
    });
  }

  /** Create the renewal and flip the previous contract to RENEWED, atomically. */
  renew(
    previous: EmploymentContract,
    data: Omit<Prisma.EmploymentContractUncheckedCreateInput, 'tenantId' | 'employeeId'>,
  ): Promise<ContractView> {
    const actorUserId = TenantContextStore.get()?.actorUserId ?? null;
    return this.run(async (tx, tenantId) => {
      const renewal = await tx.employmentContract.create({
        data: {
          ...data,
          tenantId,
          employeeId: previous.employeeId,
          renewedFromId: previous.id,
          createdById: actorUserId,
          updatedById: actorUserId,
        },
        include: INCLUDE,
      });
      await tx.employmentContract.update({
        where: { id: previous.id },
        data: { status: ContractStatus.RENEWED, updatedById: actorUserId },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'employment_contract.renew',
        entityType: 'EmploymentContract',
        entityId: renewal.id,
        metadata: { renewedFromId: previous.id },
      });
      return renewal;
    });
  }

  softDelete(id: string): Promise<EmploymentContract> {
    return this.run(async (tx, tenantId) => {
      const contract = await tx.employmentContract.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'employment_contract.delete',
        entityType: 'EmploymentContract',
        entityId: id,
      });
      return contract;
    });
  }
}
