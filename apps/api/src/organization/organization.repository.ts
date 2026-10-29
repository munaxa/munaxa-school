import { Injectable } from '@nestjs/common';
import type { OrganizationSettings, Prisma } from '@prisma/client';
import { TenantRepository } from '../common/tenant.repository';
import { TenantContextStore } from '../prisma/tenant-context';

/** The settings columns that hold an uploaded asset's object key. */
const ASSET_KEY_COLUMNS = [
  'logoKey',
  'darkLogoKey',
  'smallLogoKey',
  'stampKey',
  'signatureKey',
  'bannerKey',
  'pushIconKey',
  'notificationImageKey',
] as const satisfies readonly (keyof OrganizationSettings)[];

/** A single field-level change captured for the audit log. */
type ChangeSet = Prisma.OrganizationSettingsUpdateInput;

/**
 * Per-tenant Organization settings persistence. Every mutation is performed inside a
 * `withTenant` transaction (PostgreSQL RLS scopes it physically to the active tenant) and
 * writes an AuditLog row — with the previous and new values of the changed fields — in the
 * SAME transaction, so the change and its audit commit together.
 */
@Injectable()
export class OrganizationRepository extends TenantRepository {
  /** Whether any asset slot still holds `fileKey` (one upload may fill two slots). */
  isReferenced(fileKey: string): Promise<boolean> {
    return this.run(async (tx) => {
      const found = await tx.organizationSettings.findFirst({
        where: {
          deletedAt: null,
          OR: ASSET_KEY_COLUMNS.map((column) => ({ [column]: fileKey })),
        },
        select: { id: true },
      });
      return found !== null;
    });
  }

  /** Fetch the tenant settings, lazily creating the default row on first access. */
  getOrCreate(): Promise<OrganizationSettings> {
    return this.run(async (tx, tenantId) => this.ensure(tx, tenantId));
  }

  private async ensure(
    tx: Prisma.TransactionClient,
    tenantId: string,
  ): Promise<OrganizationSettings> {
    const existing = await tx.organizationSettings.findFirst({
      where: { tenantId, deletedAt: null },
    });
    if (existing) return existing;
    return tx.organizationSettings.create({
      data: { tenantId, createdById: TenantContextStore.get()?.actorUserId ?? null },
    });
  }

  /**
   * Apply a partial update to the tenant's settings and append an audit entry recording the
   * previous and new values for exactly the fields that changed.
   */
  update(action: string, changes: ChangeSet): Promise<OrganizationSettings> {
    return this.run(async (tx, tenantId) => {
      const current = await this.ensure(tx, tenantId);
      const data: ChangeSet = {
        ...changes,
        updatedById: TenantContextStore.get()?.actorUserId ?? null,
      };
      const updated = await tx.organizationSettings.update({
        where: { id: current.id },
        data,
      });

      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      for (const key of Object.keys(changes)) {
        before[key] = (current as Record<string, unknown>)[key] ?? null;
        after[key] = (updated as Record<string, unknown>)[key] ?? null;
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId: TenantContextStore.get()?.actorUserId ?? null,
          action,
          entityType: 'OrganizationSettings',
          entityId: updated.id,
          before: before as Prisma.InputJsonValue,
          after: after as Prisma.InputJsonValue,
        },
      });

      return updated;
    });
  }
}
