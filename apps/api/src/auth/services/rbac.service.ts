import { BadRequestException, Injectable } from '@nestjs/common';
import { RoleScope } from '@prisma/client';
import {
  type RoleKey,
  type Permission,
  ALL_PERMISSIONS,
  SCHOOL_ROLES,
  PLATFORM_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  permissionsForRole,
} from '@school/domain';
import type { TxClient } from '../../prisma/tenant.helpers';

/**
 * RBAC reads and provisioning. The authoritative role→permission baseline lives in
 * @school/domain (DEFAULT_ROLE_PERMISSIONS) and is materialized into the database here.
 */
@Injectable()
export class RbacService {
  /** Load the roles and effective permissions for a user (deduplicated). */
  async loadUserAuthz(
    tx: TxClient,
    userId: string,
  ): Promise<{ roles: string[]; permissions: Permission[] }> {
    const assignments = await tx.userRole.findMany({
      where: { userId },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });

    const roles = new Set<string>();
    const permissions = new Set<Permission>();
    for (const assignment of assignments) {
      roles.add(assignment.role.key);
      for (const rp of assignment.role.rolePermissions) {
        permissions.add(rp.permission.key as Permission);
      }
    }
    return { roles: [...roles], permissions: [...permissions] };
  }

  /**
   * Seed the system roles (and their permission mappings) for a tenant, idempotently.
   * Used during tenant provisioning (Phase 4) and in tests. Permissions must already
   * exist in the global catalog (seeded in Phase 2).
   */
  async provisionTenantRoles(tx: TxClient, tenantId: string): Promise<void> {
    await this.provisionRoles(tx, tenantId, SCHOOL_ROLES, RoleScope.SCHOOL);
  }

  /** Seed the platform-plane system roles (tenantId = null). */
  async provisionPlatformRoles(tx: TxClient): Promise<void> {
    await this.provisionRoles(tx, null, PLATFORM_ROLES, RoleScope.PLATFORM);
  }

  private async provisionRoles(
    tx: TxClient,
    tenantId: string | null,
    roleKeys: readonly RoleKey[],
    scope: RoleScope,
  ): Promise<void> {
    for (const key of roleKeys) {
      // findFirst/create rather than upsert: the (tenantId, key) unique has a nullable
      // tenantId (platform roles), which Prisma's compound-unique where cannot express.
      const role =
        (await tx.role.findFirst({ where: { tenantId, key } })) ??
        (await tx.role.create({ data: { tenantId, key, scope, isSystem: true } }));

      const permissionKeys = permissionsForRole(key);
      const permissions = await tx.permission.findMany({
        where: { key: { in: permissionKeys } },
        select: { id: true },
      });
      for (const permission of permissions) {
        await tx.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          update: {},
          create: { roleId: role.id, permissionId: permission.id },
        });
      }
    }
  }

  /**
   * Idempotently align the database with the code baseline: (1) upsert the global permission
   * catalog from {@link ALL_PERMISSIONS}, then (2) re-grant each *system* role its default
   * permission set from {@link DEFAULT_ROLE_PERMISSIONS}, for every tenant (and global roles).
   *
   * Additive only — it never removes grants, so per-tenant customizations to system roles are
   * preserved. Custom (non-system) roles are skipped. Must run under platform context
   * (`withPlatform`) so it can read/write across tenants. Used by the boot-time sync so newly
   * shipped permissions reach tenants provisioned before they existed.
   */
  async syncCatalogAndSystemRoles(tx: TxClient): Promise<{ permissions: number; roles: number }> {
    for (const key of ALL_PERMISSIONS) {
      const category = key.split(':')[0] ?? 'general';
      await tx.permission.upsert({
        where: { key },
        update: { category },
        create: { key, category },
      });
    }
    // Resolve catalog ids once (key → id) to avoid a query per grant.
    const catalog = await tx.permission.findMany({ select: { id: true, key: true } });
    const idByKey = new Map(catalog.map((p) => [p.key, p.id]));

    const roles = await tx.role.findMany({
      where: { isSystem: true },
      select: { id: true, key: true },
    });
    let synced = 0;
    for (const role of roles) {
      // Only system roles defined in the baseline; custom roles have generated keys.
      if (!(role.key in DEFAULT_ROLE_PERMISSIONS)) continue;
      for (const permKey of permissionsForRole(role.key as RoleKey)) {
        const permissionId = idByKey.get(permKey);
        if (!permissionId) continue;
        await tx.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId } },
          update: {},
          create: { roleId: role.id, permissionId },
        });
      }
      synced += 1;
    }
    return { permissions: ALL_PERMISSIONS.length, roles: synced };
  }

  /** Grant a role (by key) to a user within a tenant. */
  async assignRole(tx: TxClient, tenantId: string, userId: string, key: RoleKey): Promise<void> {
    const role = await tx.role.findUniqueOrThrow({ where: { tenantId_key: { tenantId, key } } });
    await tx.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      update: {},
      create: { tenantId, userId, roleId: role.id },
    });
  }

  /** Replace a user's role assignments with the given tenant roles (ignores foreign role ids). */
  async setUserRoles(
    tx: TxClient,
    tenantId: string,
    userId: string,
    roleIds: string[],
  ): Promise<void> {
    const valid = await tx.role.findMany({
      where: { tenantId, id: { in: roleIds } },
      select: { id: true },
    });
    await tx.userRole.deleteMany({ where: { userId, tenantId } });
    for (const role of valid) {
      await tx.userRole.create({ data: { tenantId, userId, roleId: role.id } });
    }
  }

  // ----- Per-tenant role management ----------------------------------------

  /** List a tenant's roles (system + custom) with their permission keys and assigned-user counts. */
  async listRoles(tx: TxClient, tenantId: string): Promise<RoleSummary[]> {
    const roles = await tx.role.findMany({
      where: { tenantId },
      include: {
        rolePermissions: { include: { permission: { select: { key: true } } } },
        _count: { select: { userRoles: true } },
      },
      orderBy: [{ isSystem: 'desc' }, { key: 'asc' }],
    });
    return roles.map((r) => ({
      id: r.id,
      key: r.key,
      isSystem: r.isSystem,
      nameEn: r.nameEn,
      nameAr: r.nameAr,
      permissions: r.rolePermissions.map((rp) => rp.permission.key),
      userCount: r._count.userRoles,
    }));
  }

  /**
   * Create a custom (non-system) role for a tenant. The key is a generated, unique slug so it
   * never collides with system RoleKey values. Permission keys outside the catalog are ignored.
   */
  async createCustomRole(
    tx: TxClient,
    tenantId: string,
    input: { nameEn: string; nameAr?: string | null; permissions: string[] },
  ): Promise<RoleSummary> {
    const key = await this.uniqueCustomKey(tx, tenantId, input.nameEn);
    const role = await tx.role.create({
      data: {
        tenantId,
        key,
        scope: RoleScope.SCHOOL,
        isSystem: false,
        nameEn: input.nameEn,
        nameAr: input.nameAr ?? null,
      },
    });
    await this.setRolePermissions(tx, role.id, input.permissions);
    return this.getRoleSummary(tx, role.id);
  }

  /**
   * Update a role's permission set (and optionally its display names). Allowed for both custom and
   * system roles — editing a system role customizes that template for this tenant only. The role's
   * `key` is immutable. Returns the updated summary.
   */
  async updateRole(
    tx: TxClient,
    tenantId: string,
    roleId: string,
    input: { nameEn?: string | null; nameAr?: string | null; permissions?: string[] },
  ): Promise<RoleSummary> {
    const role = await tx.role.findFirstOrThrow({ where: { id: roleId, tenantId } });
    if (input.nameEn !== undefined || input.nameAr !== undefined) {
      await tx.role.update({
        where: { id: role.id },
        data: {
          ...(input.nameEn !== undefined ? { nameEn: input.nameEn } : {}),
          ...(input.nameAr !== undefined ? { nameAr: input.nameAr } : {}),
        },
      });
    }
    if (input.permissions) {
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      await this.setRolePermissions(tx, role.id, input.permissions);
    }
    return this.getRoleSummary(tx, role.id);
  }

  /** Delete a custom role. System roles cannot be deleted; a role still assigned to users cannot. */
  async deleteCustomRole(tx: TxClient, tenantId: string, roleId: string): Promise<void> {
    const role = await tx.role.findFirstOrThrow({
      where: { id: roleId, tenantId },
      include: { _count: { select: { userRoles: true } } },
    });
    if (role.isSystem) throw new BadRequestException('System roles cannot be deleted');
    if (role._count.userRoles > 0) {
      throw new BadRequestException('Reassign its users before deleting this role');
    }
    await tx.role.delete({ where: { id: role.id } });
  }

  private async getRoleSummary(tx: TxClient, roleId: string): Promise<RoleSummary> {
    const r = await tx.role.findUniqueOrThrow({
      where: { id: roleId },
      include: {
        rolePermissions: { include: { permission: { select: { key: true } } } },
        _count: { select: { userRoles: true } },
      },
    });
    return {
      id: r.id,
      key: r.key,
      isSystem: r.isSystem,
      nameEn: r.nameEn,
      nameAr: r.nameAr,
      permissions: r.rolePermissions.map((rp) => rp.permission.key),
      userCount: r._count.userRoles,
    };
  }

  /** Map the given permission keys (only those that exist in the catalog) onto a role. */
  private async setRolePermissions(
    tx: TxClient,
    roleId: string,
    permissionKeys: string[],
  ): Promise<void> {
    const valid = permissionKeys.filter((k) => ALL_PERMISSIONS.includes(k as Permission));
    if (valid.length === 0) return;
    const permissions = await tx.permission.findMany({
      where: { key: { in: valid } },
      select: { id: true },
    });
    for (const permission of permissions) {
      await tx.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: permission.id } },
        update: {},
        create: { roleId, permissionId: permission.id },
      });
    }
  }

  /** Generate a `custom-…` slug from a name, ensuring uniqueness within the tenant. */
  private async uniqueCustomKey(tx: TxClient, tenantId: string, name: string): Promise<string> {
    const base =
      'custom-' +
      (name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'role');
    let key = base;
    let n = 1;
    while (await tx.role.findFirst({ where: { tenantId, key }, select: { id: true } })) {
      key = `${base}-${++n}`;
    }
    return key;
  }
}

export interface RoleSummary {
  id: string;
  key: string;
  isSystem: boolean;
  nameEn: string | null;
  nameAr: string | null;
  permissions: string[];
  userCount: number;
}
