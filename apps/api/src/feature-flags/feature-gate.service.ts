import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { withTenant } from '../prisma/tenant.helpers';

interface CacheEntry {
  enabled: boolean;
  expiresAt: number;
}

/**
 * Resolves whether a per-tenant feature flag is enabled. Used by the {@link FeatureFlagGuard},
 * which runs before the tenant context is bound, so the tenant id is passed explicitly and the
 * query runs under RLS via `withTenant`.
 *
 * Absence of a flag row means **disabled** — every advanced module is off until a tenant opts in.
 *
 * Results are cached in-process for a short TTL: flag checks run on every advanced-module request
 * but flags change rarely, so this removes a hot DB round-trip. The cache is best-effort and
 * per-instance; a toggle takes effect within {@link TTL_MS}.
 */
@Injectable()
export class FeatureGate {
  static readonly TTL_MS = 30_000;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  async isEnabled(tenantId: string, key: string): Promise<boolean> {
    const cacheKey = `${tenantId}:${key}`;
    const now = Date.now();
    const hit = this.cache.get(cacheKey);
    if (hit && hit.expiresAt > now) {
      return hit.enabled;
    }

    const enabled = await withTenant(this.prisma, tenantId, async (tx) => {
      const flag = await tx.featureFlag.findFirst({ where: { key }, select: { enabled: true } });
      return flag?.enabled ?? false;
    });

    this.cache.set(cacheKey, { enabled, expiresAt: now + FeatureGate.TTL_MS });
    return enabled;
  }

  /** Drop a cached entry (e.g. after a flag toggle) so the next check re-reads the DB. */
  invalidate(tenantId: string, key: string): void {
    this.cache.delete(`${tenantId}:${key}`);
  }
}
