import { Injectable } from '@nestjs/common';
import { AssetStatus, type AssetCondition, type Prisma, type Asset } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';
import { TenantContextStore } from '../../prisma/tenant-context';

const ASSET_INCLUDE = {
  currentAssignee: { select: { id: true, firstNameEn: true, lastNameEn: true } },
} satisfies Prisma.AssetInclude;

const ASSIGNMENT_INCLUDE = {
  asset: { select: { id: true, assetTag: true, name: true, category: true } },
  employee: { select: { id: true, firstNameEn: true, lastNameEn: true } },
} satisfies Prisma.AssetAssignmentInclude;

export type AssetView = Prisma.AssetGetPayload<{ include: typeof ASSET_INCLUDE }>;
export type AssetDetailView = Prisma.AssetGetPayload<{
  include: {
    currentAssignee: { select: { id: true; firstNameEn: true; lastNameEn: true } };
    assignments: { include: typeof ASSIGNMENT_INCLUDE };
  };
}>;
export type AssignmentView = Prisma.AssetAssignmentGetPayload<{
  include: typeof ASSIGNMENT_INCLUDE;
}>;

@Injectable()
export class AssetRepository extends TenantRepository {
  createAsset(data: Omit<Prisma.AssetUncheckedCreateInput, 'tenantId'>): Promise<AssetView> {
    return this.run(async (tx, tenantId) => {
      const asset = await tx.asset.create({
        data: { ...data, tenantId },
        include: ASSET_INCLUDE,
      });
      await this.writeAudit(tx, tenantId, {
        action: 'asset.create',
        entityType: 'Asset',
        entityId: asset.id,
      });
      return asset;
    });
  }
  listAssets(filters: { status?: AssetStatus; category?: string }): Promise<AssetView[]> {
    return this.run((tx) => {
      const where: Prisma.AssetWhereInput = { deletedAt: null };
      if (filters.status) where.status = filters.status;
      if (filters.category) where.category = filters.category as never;
      return tx.asset.findMany({ where, include: ASSET_INCLUDE, orderBy: { assetTag: 'asc' } });
    });
  }
  findAsset(id: string): Promise<Asset | null> {
    return this.run((tx) => tx.asset.findFirst({ where: { id, deletedAt: null } }));
  }
  findAssetDetail(id: string): Promise<AssetDetailView | null> {
    return this.run((tx) =>
      tx.asset.findFirst({
        where: { id, deletedAt: null },
        include: {
          currentAssignee: { select: { id: true, firstNameEn: true, lastNameEn: true } },
          assignments: { include: ASSIGNMENT_INCLUDE, orderBy: { assignedAt: 'desc' } },
        },
      }),
    );
  }
  updateAsset(id: string, data: Prisma.AssetUncheckedUpdateInput): Promise<AssetView> {
    return this.run(async (tx, tenantId) => {
      const asset = await tx.asset.update({ where: { id }, data, include: ASSET_INCLUDE });
      await this.writeAudit(tx, tenantId, {
        action: 'asset.update',
        entityType: 'Asset',
        entityId: id,
      });
      return asset;
    });
  }
  softDeleteAsset(id: string): Promise<Asset> {
    return this.run(async (tx, tenantId) => {
      const asset = await tx.asset.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.writeAudit(tx, tenantId, {
        action: 'asset.delete',
        entityType: 'Asset',
        entityId: id,
      });
      return asset;
    });
  }

  employeeExists(employeeId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.employee.findFirst({ where: { id: employeeId, deletedAt: null } })) !== null,
    );
  }

  /** Assign an asset to an employee: open a custody record and flip the asset to ASSIGNED. */
  assign(
    assetId: string,
    employeeId: string,
    dueDate: Date | null,
    note: string | null,
  ): Promise<AssignmentView> {
    const assignedById = TenantContextStore.get()?.actorUserId ?? null;
    return this.run(async (tx, tenantId) => {
      const assignment = await tx.assetAssignment.create({
        data: { tenantId, assetId, employeeId, dueDate, note, assignedById },
        include: ASSIGNMENT_INCLUDE,
      });
      await tx.asset.update({
        where: { id: assetId },
        data: { status: AssetStatus.ASSIGNED, currentAssigneeId: employeeId },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'asset.assign',
        entityType: 'Asset',
        entityId: assetId,
        metadata: { employeeId, assignmentId: assignment.id },
      });
      return assignment;
    });
  }

  /** Return an asset: close its open custody record and set the post-return status. */
  return(
    assetId: string,
    assignmentId: string,
    returnCondition: AssetCondition | null,
    status: AssetStatus,
    note: string | null,
  ): Promise<AssignmentView> {
    return this.run(async (tx, tenantId) => {
      const assignment = await tx.assetAssignment.update({
        where: { id: assignmentId },
        data: {
          returnedAt: new Date(),
          returnCondition,
          ...(note !== null ? { note } : {}),
        },
        include: ASSIGNMENT_INCLUDE,
      });
      await tx.asset.update({
        where: { id: assetId },
        data: {
          status,
          currentAssigneeId: null,
          ...(returnCondition ? { condition: returnCondition } : {}),
        },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'asset.return',
        entityType: 'Asset',
        entityId: assetId,
        metadata: { assignmentId, status },
      });
      return assignment;
    });
  }

  /** The open (unreturned) assignment for an asset, if any. */
  openAssignment(assetId: string): Promise<{ id: string } | null> {
    return this.run((tx) =>
      tx.assetAssignment.findFirst({
        where: { assetId, returnedAt: null },
        select: { id: true },
      }),
    );
  }

  listForEmployee(employeeId: string): Promise<AssignmentView[]> {
    return this.run((tx) =>
      tx.assetAssignment.findMany({
        where: { employeeId },
        include: ASSIGNMENT_INCLUDE,
        orderBy: { assignedAt: 'desc' },
      }),
    );
  }
}
