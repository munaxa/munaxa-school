import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { withPlatform, type TxClient } from '../../prisma/tenant.helpers';
import { TenantContextStore } from '../../prisma/tenant-context';
import { PLATFORM_TENANT_ID } from '../platform.constants';

/**
 * Control-plane access to {@link Organization} (school groups). Cross-tenant via `withPlatform`;
 * every mutation is audited in the same transaction. Assigning/removing schools only flips the
 * nullable `Tenant.organizationId`, so standalone schools (organizationId = null) are unaffected.
 */
@Injectable()
export class OrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private audit(
    tx: TxClient,
    p: {
      action: string;
      entityId: string;
      tenantId?: string | null;
      metadata?: Prisma.InputJsonValue;
    },
  ): Promise<unknown> {
    return tx.auditLog.create({
      data: {
        tenantId: p.tenantId ?? null,
        actorUserId: TenantContextStore.get()?.actorUserId ?? null,
        actorRole: 'platform',
        action: p.action,
        entityType: 'Organization',
        entityId: p.entityId,
        ...(p.metadata !== undefined ? { metadata: p.metadata } : {}),
      },
    });
  }

  list(includeArchived: boolean) {
    return withPlatform(this.prisma, (tx) =>
      tx.organization.findMany({
        where: includeArchived ? {} : { isArchived: false },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { tenants: true } } },
      }),
    );
  }

  get(id: string) {
    return withPlatform(this.prisma, (tx) =>
      tx.organization.findUnique({
        where: { id },
        include: {
          tenants: {
            where: { id: { not: PLATFORM_TENANT_ID } },
            include: {
              subscription: { include: { plan: true } },
              subscriptionUsages: true,
              _count: { select: { students: true, campuses: true } },
            },
          },
        },
      }),
    );
  }

  create(data: Prisma.OrganizationUncheckedCreateInput) {
    return withPlatform(this.prisma, async (tx) => {
      const org = await tx.organization.create({ data });
      await this.audit(tx, {
        action: 'platform.organization.create',
        entityId: org.id,
        metadata: { name: org.name },
      });
      return org;
    });
  }

  update(id: string, data: Prisma.OrganizationUpdateInput) {
    return withPlatform(this.prisma, async (tx) => {
      const org = await tx.organization.update({ where: { id }, data });
      await this.audit(tx, { action: 'platform.organization.update', entityId: id });
      return org;
    });
  }

  /** Archive: mark archived and detach all member schools (they revert to standalone). */
  archive(id: string) {
    return withPlatform(this.prisma, async (tx) => {
      await tx.tenant.updateMany({ where: { organizationId: id }, data: { organizationId: null } });
      const org = await tx.organization.update({
        where: { id },
        data: { isArchived: true, archivedAt: new Date() },
      });
      await this.audit(tx, { action: 'platform.organization.archive', entityId: id });
      return org;
    });
  }

  assignSchool(orgId: string, tenantId: string) {
    return withPlatform(this.prisma, async (tx) => {
      await tx.tenant.update({ where: { id: tenantId }, data: { organizationId: orgId } });
      await this.audit(tx, {
        action: 'platform.organization.assign_school',
        entityId: orgId,
        tenantId,
        metadata: { tenantId },
      });
      return tx.organization.findUniqueOrThrow({
        where: { id: orgId },
        include: { _count: { select: { tenants: true } } },
      });
    });
  }

  removeSchool(orgId: string, tenantId: string) {
    return withPlatform(this.prisma, async (tx) => {
      await tx.tenant.updateMany({
        where: { id: tenantId, organizationId: orgId },
        data: { organizationId: null },
      });
      await this.audit(tx, {
        action: 'platform.organization.remove_school',
        entityId: orgId,
        tenantId,
        metadata: { tenantId },
      });
      return tx.organization.findUniqueOrThrow({
        where: { id: orgId },
        include: { _count: { select: { tenants: true } } },
      });
    });
  }

  /** Schools not yet in any organization (candidates to assign). Excludes the reserved tenant. */
  assignableSchools() {
    return withPlatform(this.prisma, (tx) =>
      tx.tenant.findMany({
        where: { organizationId: null, id: { not: PLATFORM_TENANT_ID } },
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' },
      }),
    );
  }
}
