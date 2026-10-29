import { Injectable, Logger } from '@nestjs/common';
import { parseEntitlementSnapshot, type EntitlementSnapshot } from '@munaxa/licensing';
import { TenantConnectionManager } from '../prisma/tenant-connection.service';
import { withTenant } from '../prisma/tenant.helpers';

export interface StoredLicensingState {
  /** The last snapshot verified for the school; `null` when the source said "no subscription". */
  readonly snapshot: EntitlementSnapshot | null;
  readonly lastObservedAt: Date;
  /** The newest revocation list verified for this installation, as delivered; `null` when none. */
  readonly revocationList: string | null;
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
  /**
   * Keeps a newly verified revocation list. Only a higher `sequence` replaces the stored one, so two
   * processes racing can never put an older list back. A school with no state row yet keeps
   * nothing; the next check, after its state is written, keeps it.
   */
  abstract writeRevocationList(tenantId: string, list: string, sequence: number): Promise<void>;
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
      revocationList: row.revocationList,
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

  async writeRevocationList(tenantId: string, list: string, sequence: number): Promise<void> {
    await withTenant(
      this.connections.clientFor(tenantId),
      tenantId,
      (tx) =>
        tx.$executeRaw`
        UPDATE "LicensingState"
           SET "revocationList" = ${list}, "revocationSequence" = ${sequence}, "updatedAt" = now()
         WHERE "tenantId" = ${tenantId}::uuid
           AND ("revocationSequence" IS NULL OR "revocationSequence" < ${sequence})`,
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
    const revocationList = this.rows.get(tenantId)?.revocationList ?? null;
    this.rows.set(tenantId, { snapshot: state.snapshot, lastObservedAt, revocationList });
    return Promise.resolve();
  }

  readonly sequences = new Map<string, number>();

  writeRevocationList(tenantId: string, list: string, sequence: number): Promise<void> {
    const row = this.rows.get(tenantId);
    const previous = this.sequences.get(tenantId);
    if (row !== undefined && (previous === undefined || previous < sequence)) {
      this.rows.set(tenantId, { ...row, revocationList: list });
      this.sequences.set(tenantId, sequence);
    }
    return Promise.resolve();
  }
}
