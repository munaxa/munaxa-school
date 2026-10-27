import { Injectable, Logger } from '@nestjs/common';
import { parseEntitlementSnapshot, type EntitlementSnapshot } from '@munaxa/licensing';
import { TenantConnectionManager } from '../prisma/tenant-connection.service';
import { withTenant } from '../prisma/tenant.helpers';

export interface StoredLicensingState {
  /** The last snapshot verified for the school; `null` when the source said "no subscription". */
  readonly snapshot: EntitlementSnapshot | null;
  readonly lastObservedAt: Date;
}

export interface LicensingStateWrite {
  readonly snapshot: EntitlementSnapshot | null;
  readonly source: 'LICENSE_FILE' | 'CONTROL_PLANE';
  readonly observedAt: Date;
}

/** The `LicensingState` port; bound to Postgres in the app and to a map in tests. */
export abstract class LicensingStateStore {
  abstract read(tenantId: string): Promise<StoredLicensingState | null>;
  /** `lastObservedAt` only moves forward: the stored value is the later of the two. */
  abstract write(tenantId: string, state: LicensingStateWrite): Promise<void>;
}

/**
 * What this deployment last verified about a school's entitlements, kept across restarts. Read and
 * written under the school's own row-level security (`withTenant`), on the school's own database.
 */
@Injectable()
export class PrismaLicensingStateStore extends LicensingStateStore {
  private readonly logger = new Logger(PrismaLicensingStateStore.name);

  constructor(private readonly connections: TenantConnectionManager) {
    super();
  }

  async read(tenantId: string): Promise<StoredLicensingState | null> {
    const row = await withTenant(this.connections.clientFor(tenantId), tenantId, (tx) =>
      tx.licensingState.findUnique({ where: { tenantId } }),
    );
    if (!row) return null;
    // A stored snapshot that no longer satisfies the contract is treated as none — never a grant.
    const parsed = row.snapshot === null ? null : parseEntitlementSnapshot(row.snapshot);
    if (parsed && !parsed.ok) this.logger.warn(`Stored licensing state for ${tenantId} is invalid`);
    return {
      snapshot: parsed?.ok ? parsed.snapshot : null,
      lastObservedAt: row.lastObservedAt,
    };
  }

  async write(tenantId: string, state: LicensingStateWrite): Promise<void> {
    const snapshot = state.snapshot === null ? null : JSON.stringify(state.snapshot);
    await withTenant(
      this.connections.clientFor(tenantId),
      tenantId,
      (tx) =>
        tx.$executeRaw`
        INSERT INTO "LicensingState" ("tenantId", "snapshot", "source", "lastObservedAt", "updatedAt")
        VALUES (${tenantId}::uuid, ${snapshot}::jsonb, ${state.source}, ${state.observedAt}, now())
        ON CONFLICT ("tenantId") DO UPDATE SET
          "snapshot" = EXCLUDED."snapshot",
          "source" = EXCLUDED."source",
          "lastObservedAt" = GREATEST("LicensingState"."lastObservedAt", EXCLUDED."lastObservedAt"),
          "updatedAt" = now()`,
    );
  }
}

/** The same forward-only rule in a map: for tests, and for nothing else. */
export class MemoryLicensingStateStore extends LicensingStateStore {
  readonly rows = new Map<string, StoredLicensingState>();

  read(tenantId: string): Promise<StoredLicensingState | null> {
    return Promise.resolve(this.rows.get(tenantId) ?? null);
  }

  write(tenantId: string, state: LicensingStateWrite): Promise<void> {
    const previous = this.rows.get(tenantId)?.lastObservedAt;
    const lastObservedAt =
      previous !== undefined && previous > state.observedAt ? previous : state.observedAt;
    this.rows.set(tenantId, { snapshot: state.snapshot, lastObservedAt });
    return Promise.resolve();
  }
}
