import { Injectable } from '@nestjs/common';
import type { Prisma, TenantDatabase } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { withPlatform } from '../../prisma/tenant.helpers';

/**
 * Control-plane access to the {@link TenantDatabase} registry. This is a platform-plane resource
 * (cross-tenant), so it runs under `withPlatform` against the shared control-plane database — not
 * the tenant-scoped `TenantRepository`.
 */
@Injectable()
export class TenantProvisioningRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<Array<TenantDatabase & { tenant: { name: string; slug: string } }>> {
    return withPlatform(this.prisma, (tx) =>
      tx.tenantDatabase.findMany({
        include: { tenant: { select: { name: true, slug: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
    );
  }

  findByTenant(tenantId: string): Promise<TenantDatabase | null> {
    return withPlatform(this.prisma, (tx) => tx.tenantDatabase.findFirst({ where: { tenantId } }));
  }

  tenantExists(tenantId: string): Promise<boolean> {
    return withPlatform(
      this.prisma,
      async (tx) => (await tx.tenant.findFirst({ where: { id: tenantId } })) !== null,
    );
  }

  create(data: Prisma.TenantDatabaseUncheckedCreateInput): Promise<TenantDatabase> {
    return withPlatform(this.prisma, (tx) => tx.tenantDatabase.create({ data }));
  }

  update(id: string, data: Prisma.TenantDatabaseUpdateInput): Promise<TenantDatabase> {
    return withPlatform(this.prisma, (tx) => tx.tenantDatabase.update({ where: { id }, data }));
  }
}
