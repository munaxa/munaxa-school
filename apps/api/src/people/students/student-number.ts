import type { TxClient } from '../../prisma/tenant.helpers';

/** Format an internal Student Number from its parts (Decision 6): `${prefix}${zero-padded number}`. */
export function formatStudentNumber(n: number, prefix: string | null, padLength: number): string {
  return `${prefix ?? ''}${String(n).padStart(Math.max(0, padLength), '0')}`;
}

/**
 * Allocate the next internal Student Number for a tenant (Decision 6), inside an existing transaction.
 *
 * Uses the gapless, row-locked counter idiom (same as PaymentReceiptCounter): lazily create the
 * per-tenant `StudentNumberCounter`, then atomically increment `nextNumber` and read back the value +
 * format config in a single UPDATE … RETURNING (so concurrent admissions never collide or gap).
 * Formats as `${prefix ?? ''}${zero-padded number}` — e.g. "000123", or "S-000123" with a prefix.
 */
export async function allocateStudentNumber(tx: TxClient, tenantId: string): Promise<string> {
  await tx.$executeRaw`
    INSERT INTO "StudentNumberCounter" ("id", "tenantId", "updatedAt")
    VALUES (gen_random_uuid(), ${tenantId}::uuid, CURRENT_TIMESTAMP)
    ON CONFLICT ("tenantId") DO NOTHING`;

  const rows = await tx.$queryRaw<{ n: number; prefix: string | null; padLength: number }[]>`
    UPDATE "StudentNumberCounter"
    SET "nextNumber" = "nextNumber" + 1, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "tenantId" = ${tenantId}::uuid
    RETURNING "nextNumber" - 1 AS "n", "prefix", "padLength"`;

  const { n, prefix, padLength } = rows[0]!;
  return formatStudentNumber(n, prefix, padLength);
}
