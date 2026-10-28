import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantConnectionManager } from '../prisma/tenant-connection.service';
import { withTenant, type TxClient } from '../prisma/tenant.helpers';
import { TenantContextStore } from '../prisma/tenant-context';
import { requireTenantId } from './tenant.util';

/**
 * Base repository for tenant-scoped data access. Every operation runs inside a
 * `withTenant` transaction so PostgreSQL RLS physically scopes it to the active tenant
 * (resolved from the request-scoped TenantContext). The explicit `tenantId` is also
 * available to stamp on writes.
 *
 * The client is resolved per tenant via {@link TenantConnectionManager}: the shared database by
 * default, or the tenant's own database when it has been siloed. RLS applies identically either
 * way, so isolation is never weaker than the shared path.
 */
@Injectable()
export abstract class TenantRepository {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly connections: TenantConnectionManager,
  ) {}

  /** Run a unit of work scoped to the current tenant, against that tenant's database. */
  protected run<T>(fn: (tx: TxClient, tenantId: string) => Promise<T>): Promise<T> {
    const tenantId = requireTenantId();
    return withTenant(this.connections.clientFor(tenantId), tenantId, (tx) => fn(tx, tenantId));
  }

  /**
   * {@link run}, holding a transaction-scoped advisory lock on `(scope, tenant)` first, so units of
   * work in the same scope for the same tenant run one at a time. For check-then-act on a count — a
   * plan limit — where two concurrent requests would otherwise both see room for one more. The lock
   * is released when the transaction ends; other tenants and other scopes never wait for it.
   */
  protected runSerialized<T>(
    scope: string,
    fn: (tx: TxClient, tenantId: string) => Promise<T>,
  ): Promise<T> {
    return this.run(async (tx, tenantId) => {
      await lockScope(tx, scope, tenantId);
      return fn(tx, tenantId);
    });
  }

  /**
   * Write an audit log entry inside the SAME transaction as a state change, so the action and
   * its audit commit together (mandatory for financial actions — see Phase 9 / doc 10).
   */
  protected writeAudit(
    tx: TxClient,
    tenantId: string,
    params: {
      action: string;
      entityType: string;
      entityId?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ): Promise<unknown> {
    return tx.auditLog.create({
      data: {
        tenantId,
        actorUserId: TenantContextStore.get()?.actorUserId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
      },
    });
  }
}

/**
 * Takes the transaction-scoped advisory lock on `(scope, tenant)`, for a unit of work that is
 * already inside a transaction (see `TenantRepository.runSerialized`). Released at commit or
 * rollback.
 */
export async function lockScope(tx: TxClient, scope: string, tenantId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${scope}), hashtext(${tenantId}))`;
}
