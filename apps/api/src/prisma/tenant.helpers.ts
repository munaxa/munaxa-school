import type { Prisma, PrismaClient } from '@prisma/client';

/** The transactional Prisma client passed to callbacks. */
export type TxClient = Prisma.TransactionClient;

/**
 * Run `fn` inside a transaction with the PostgreSQL RLS tenant context set, so that
 * every query within is physically scoped to `tenantId` by the database (layer 4 of the
 * isolation strategy). `set_config(..., true)` makes the setting local to the transaction.
 *
 * Phase 3 wires this into request handling via a tenant guard/interceptor that reads
 * the resolved tenant from {@link TenantContextStore}.
 */
export async function withTenant<T>(
  prisma: PrismaClient,
  tenantId: string,
  fn: (tx: TxClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}

/**
 * Run `fn` inside a transaction with platform (cross-tenant) RLS context. Reserved for
 * platform-plane operations and MUST be accompanied by an audit log entry (see
 * docs/architecture/10-audit-logging-strategy.md).
 */
export async function withPlatform<T>(
  prisma: PrismaClient,
  fn: (tx: TxClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.is_platform', 'on', true)`;
    return fn(tx);
  });
}
