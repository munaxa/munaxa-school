import { Injectable } from '@nestjs/common';
import { TenantRepository } from '../common/tenant.repository';
import { PrismaService } from '../prisma/prisma.service';
import { TenantConnectionManager } from '../prisma/tenant-connection.service';
import { RbacService, type RoleSummary } from '../auth/services/rbac.service';
import type { CreateRoleDto, UpdateRoleDto } from './roles.dto';

export interface PermissionCatalogEntry {
  key: string;
  category: string;
  description: string | null;
}

/** Tenant-scoped role administration (RLS-enforced) layered on top of RbacService. */
@Injectable()
export class RolesRepository extends TenantRepository {
  constructor(
    prisma: PrismaService,
    connections: TenantConnectionManager,
    private readonly rbac: RbacService,
  ) {
    super(prisma, connections);
  }

  list(): Promise<RoleSummary[]> {
    return this.run((tx, tenantId) => this.rbac.listRoles(tx, tenantId));
  }

  /** The global permission catalog grouped for the editor (category → permissions). */
  catalog(): Promise<PermissionCatalogEntry[]> {
    return this.run((tx) =>
      tx.permission.findMany({
        select: { key: true, category: true, description: true },
        orderBy: [{ category: 'asc' }, { key: 'asc' }],
      }),
    );
  }

  create(dto: CreateRoleDto): Promise<RoleSummary> {
    return this.run(async (tx, tenantId) => {
      const role = await this.rbac.createCustomRole(tx, tenantId, {
        nameEn: dto.nameEn,
        nameAr: dto.nameAr ?? null,
        permissions: dto.permissions,
      });
      await this.writeAudit(tx, tenantId, {
        action: 'role.create',
        entityType: 'Role',
        entityId: role.id,
        metadata: { key: role.key, permissions: role.permissions },
      });
      return role;
    });
  }

  update(id: string, dto: UpdateRoleDto): Promise<RoleSummary> {
    return this.run(async (tx, tenantId) => {
      const role = await this.rbac.updateRole(tx, tenantId, id, {
        ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn } : {}),
        ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr } : {}),
        ...(dto.permissions !== undefined ? { permissions: dto.permissions } : {}),
      });
      await this.writeAudit(tx, tenantId, {
        action: 'role.update',
        entityType: 'Role',
        entityId: role.id,
        metadata: { key: role.key, permissions: role.permissions },
      });
      return role;
    });
  }

  remove(id: string): Promise<void> {
    return this.run(async (tx, tenantId) => {
      await this.rbac.deleteCustomRole(tx, tenantId, id);
      await this.writeAudit(tx, tenantId, {
        action: 'role.delete',
        entityType: 'Role',
        entityId: id,
      });
    });
  }
}
