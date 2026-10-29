import { ForbiddenException, Injectable } from '@nestjs/common';
import type { StoredObject } from '@prisma/client';
import { withTenant, type TxClient } from '../prisma/tenant.helpers';
import { CAPACITY_SCOPE, type Capacity } from '../subscription/capacity';
import { lockScope, TenantRepository } from './tenant.repository';

export const STORED_OBJECT_STATE = {
  RESERVED: 'RESERVED',
  STORED: 'STORED',
  DELETED: 'DELETED',
} as const;

/** What confirming an upload did. `total` is the bytes the school stores afterwards. */
export type CommitOutcome =
  | { readonly kind: 'stored'; readonly total: bigint }
  | { readonly kind: 'already-stored'; readonly total: bigint }
  | { readonly kind: 'refused'; readonly total: bigint }
  | { readonly kind: 'gone' };

/**
 * The ledger of the bytes each school holds in the bucket — the `StoredObject` table — and the
 * only place the storage limit is decided.
 *
 * Every decision that adds bytes takes the tenant's storage lock (`CAPACITY_SCOPE.storage`) and
 * counts inside that one transaction, as the student, campus and staff limits do (`assertRoom`): what counts is
 * every `STORED` object at the size the bucket reported, plus every `RESERVED` upload that has not
 * expired at the size it may still grow to. Two concurrent uploads can therefore never both take
 * the last of the room.
 *
 * Sizes are `bigint` here and in the table: a school's total can pass 2^31 bytes.
 */
@Injectable()
export class StorageLedgerRepository extends TenantRepository {
  /**
   * Reserves `bytes` for an upload URL about to be issued for `key`, until `expiresAt`. Refuses with
   * the capacity's refusal when the reservation would not fit. Returns the school's stored total.
   */
  reserve(key: string, bytes: bigint, expiresAt: Date, capacity: Capacity): Promise<bigint> {
    return this.runSerialized(CAPACITY_SCOPE.storage, async (tx, tenantId) => {
      const used = await committedBytes(tx, new Date());
      assertBytesFit(capacity, used, bytes);
      await tx.storedObject.create({
        data: {
          key,
          tenantId,
          state: STORED_OBJECT_STATE.RESERVED,
          reservedBytes: bytes,
          expiresAt,
        },
      });
      return storedBytes(tx);
    });
  }

  /**
   * Records `key` as stored at `actualBytes` — the size the bucket reports, never a size the client
   * declared. Re-checks the limit with this object's real size in place of its reservation, so an
   * upload that is larger than it claimed, or that was never reserved (an upload URL issued before
   * this ledger existed), is still held to the limit. Confirming the same key again changes
   * nothing. A key the ledger already marked deleted stays deleted.
   */
  commit(
    key: string,
    actualBytes: bigint,
    capacity: Capacity,
    now = new Date(),
  ): Promise<CommitOutcome> {
    return this.runSerialized(CAPACITY_SCOPE.storage, async (tx, tenantId) => {
      const row = await tx.storedObject.findUnique({ where: { key } });
      if (row?.state === STORED_OBJECT_STATE.STORED) {
        return { kind: 'already-stored', total: await storedBytes(tx) };
      }
      if (row?.state === STORED_OBJECT_STATE.DELETED) {
        return { kind: 'gone' };
      }
      const others =
        (await committedBytes(tx, now)) - (row && row.expiresAt > now ? row.reservedBytes : 0n);
      if (capacity.limit !== null && others + actualBytes > limitBytes(capacity)) {
        await upsertState(tx, tenantId, key, STORED_OBJECT_STATE.DELETED, actualBytes, null, now);
        return { kind: 'refused', total: await storedBytes(tx) };
      }
      await upsertState(
        tx,
        tenantId,
        key,
        STORED_OBJECT_STATE.STORED,
        actualBytes,
        actualBytes,
        now,
      );
      return { kind: 'stored', total: await storedBytes(tx) };
    });
  }

  /** Marks `key` deleted. Returns the school's stored total afterwards. */
  release(key: string): Promise<bigint> {
    return this.runSerialized(CAPACITY_SCOPE.storage, async (tx) => {
      await tx.storedObject.updateMany({
        where: { key, state: { not: STORED_OBJECT_STATE.DELETED } },
        data: { state: STORED_OBJECT_STATE.DELETED },
      });
      return storedBytes(tx);
    });
  }

  /** Reservations whose upload URL has expired and that were never confirmed. */
  expiredReservations(now = new Date(), take = 100): Promise<StoredObject[]> {
    return this.run((tx) =>
      tx.storedObject.findMany({
        where: { state: STORED_OBJECT_STATE.RESERVED, expiresAt: { lte: now } },
        orderBy: { expiresAt: 'asc' },
        take,
      }),
    );
  }

  /**
   * Settles an expired reservation with what the bucket holds: `STORED` at `actualBytes` when the
   * object arrived (it occupies the bucket whether or not anyone confirmed it), `DELETED` when it
   * did not. Only a row still `RESERVED` is touched, so a confirmation that raced it wins.
   */
  settle(key: string, actualBytes: bigint | null): Promise<void> {
    return this.runSerialized(CAPACITY_SCOPE.storage, async (tx) => {
      await tx.storedObject.updateMany({
        where: { key, state: STORED_OBJECT_STATE.RESERVED },
        data:
          actualBytes === null
            ? { state: STORED_OBJECT_STATE.DELETED }
            : { state: STORED_OBJECT_STATE.STORED, storedBytes: actualBytes },
      });
    });
  }

  /**
   * The size reserved for `key`, or `null` when nothing was reserved. Stands in for the bucket's
   * answer only where there is no bucket (development and tests), so the flow stays exercisable.
   */
  async reservedSize(key: string): Promise<bigint | null> {
    const row = await this.run((tx) => tx.storedObject.findUnique({ where: { key } }));
    return row ? row.reservedBytes : null;
  }

  /** The bytes the current school stores. */
  totalStored(): Promise<bigint> {
    return this.run((tx) => storedBytes(tx));
  }

  /**
   * Reconciliation, for one school named explicitly (the job runs outside any request): makes the
   * ledger agree with a listing of the school's prefix in the bucket. An object the ledger does
   * not know, or knows only as an expired reservation, is recorded as stored at its listed size;
   * a stored object the bucket no longer has is marked deleted. Live reservations are left alone —
   * their upload may still be in flight. Never refuses: these bytes are already in the bucket.
   */
  reconcile(
    tenantId: string,
    listed: ReadonlyMap<string, bigint>,
    now = new Date(),
  ): Promise<{ adopted: number; vanished: number; total: bigint }> {
    return withTenant(this.connections.clientFor(tenantId), tenantId, async (tx) => {
      await lockScope(tx, CAPACITY_SCOPE.storage, tenantId);
      const rows = await tx.storedObject.findMany({
        where: { state: { not: STORED_OBJECT_STATE.DELETED } },
      });
      const known = new Map(rows.map((row) => [row.key, row]));
      let adopted = 0;
      let vanished = 0;
      for (const [key, bytes] of listed) {
        const row = known.get(key);
        if (row?.state === STORED_OBJECT_STATE.STORED && row.storedBytes === bytes) continue;
        if (row?.state === STORED_OBJECT_STATE.RESERVED && row.expiresAt > now) continue;
        await upsertState(tx, tenantId, key, STORED_OBJECT_STATE.STORED, bytes, bytes, now);
        adopted += 1;
      }
      for (const row of rows) {
        const live = row.state === STORED_OBJECT_STATE.RESERVED && row.expiresAt > now;
        if (!listed.has(row.key) && !live) {
          await tx.storedObject.update({
            where: { key: row.key },
            data: { state: STORED_OBJECT_STATE.DELETED },
          });
          vanished += 1;
        }
      }
      return { adopted, vanished, total: await storedBytes(tx) };
    });
  }
}

/** One gibibyte: `storage_gb` limits are counted in binary gigabytes, as object storage bills them. */
export const BYTES_PER_GB = 1024n ** 3n;

/** A storage capacity's limit in bytes (its `limit` is in GB, as the plan states it). */
export function limitBytes(capacity: Capacity): bigint {
  return capacity.limit === null ? 0n : BigInt(Math.floor(capacity.limit * Number(BYTES_PER_GB)));
}

/** {@link assertRoom}, in bytes. */
export function assertBytesFit(capacity: Capacity, used: bigint, additional: bigint): void {
  if (capacity.limit !== null && used + additional > limitBytes(capacity)) {
    throw capacity.refusal ?? new ForbiddenException('Your plan does not allow storing more.');
  }
}

/** Stored bytes plus the bytes live reservations may still add. */
async function committedBytes(tx: TxClient, now: Date): Promise<bigint> {
  const [stored, reserved] = await Promise.all([
    tx.storedObject.aggregate({
      where: { state: STORED_OBJECT_STATE.STORED },
      _sum: { storedBytes: true },
    }),
    tx.storedObject.aggregate({
      where: { state: STORED_OBJECT_STATE.RESERVED, expiresAt: { gt: now } },
      _sum: { reservedBytes: true },
    }),
  ]);
  return (stored._sum.storedBytes ?? 0n) + (reserved._sum.reservedBytes ?? 0n);
}

async function storedBytes(tx: TxClient): Promise<bigint> {
  const stored = await tx.storedObject.aggregate({
    where: { state: STORED_OBJECT_STATE.STORED },
    _sum: { storedBytes: true },
  });
  return stored._sum.storedBytes ?? 0n;
}

function upsertState(
  tx: TxClient,
  tenantId: string,
  key: string,
  state: string,
  reservedBytes: bigint,
  stored: bigint | null,
  now: Date,
): Promise<StoredObject> {
  return tx.storedObject.upsert({
    where: { key },
    create: { key, tenantId, state, reservedBytes, storedBytes: stored, expiresAt: now },
    update: { state, storedBytes: stored },
  });
}
