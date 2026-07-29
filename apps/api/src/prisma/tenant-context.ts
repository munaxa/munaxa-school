import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Request-scoped tenant context. Resolved from the authenticated principal (Phase 3)
 * and read by the data layer to scope every query to a single tenant.
 *
 * This is layer 2 of the tenant-isolation strategy (see
 * docs/architecture/03-multi-tenant-architecture.md). It pairs with the PostgreSQL
 * RLS policies (layer 4) via `withTenant` / `withPlatform`.
 */
export interface TenantContext {
  /** The active tenant for school-plane requests. */
  tenantId?: string;
  /** True for platform-plane (cross-tenant) operations. */
  isPlatform?: boolean;
  /** The acting user (for audit attribution). */
  actorUserId?: string;
  /** The acting principal's permission keys (for service-layer row-scoping decisions). */
  permissions?: string[];
}

const storage = new AsyncLocalStorage<TenantContext>();

export const TenantContextStore = {
  /** Run a callback with the given tenant context bound for its async lifetime. */
  run<T>(context: TenantContext, callback: () => T): T {
    return storage.run(context, callback);
  },
  /** The current context, if any. */
  get(): TenantContext | undefined {
    return storage.getStore();
  },
  /** The current tenantId, if a school-plane context is active. */
  getTenantId(): string | undefined {
    return storage.getStore()?.tenantId;
  },
  /** Whether the current context is platform-plane. */
  isPlatform(): boolean {
    return storage.getStore()?.isPlatform ?? false;
  },
};
