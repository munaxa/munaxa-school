import type { TxClient } from '../../prisma/tenant.helpers';

/** Format a staff number from its parts: `${prefix}${zero-padded number}` — e.g. "E-0007". */
export function formatEmployeeNumber(n: number, prefix: string | null, padLength: number): string {
  return `${prefix ?? ''}${String(n).padStart(Math.max(0, padLength), '0')}`;
}

/**
 * Allocate the next staff number for a tenant, inside an existing transaction.
 *
 * Every employee carries one — it is how payroll, attendance devices and the staff card refer to
 * a person — so it is issued at hire rather than typed in and hoped for. Uses the gapless,
 * row-locked counter idiom (same as StudentNumberCounter): lazily create the per-tenant counter,
 * then atomically increment and read back the value + format config in one UPDATE … RETURNING, so
 * two people hired at the same moment can never take the same number.
 */
export async function allocateEmployeeNumber(tx: TxClient, tenantId: string): Promise<string> {
  await tx.$executeRaw`
    INSERT INTO "EmployeeNumberCounter" ("id", "tenantId", "updatedAt")
    VALUES (gen_random_uuid(), ${tenantId}::uuid, CURRENT_TIMESTAMP)
    ON CONFLICT ("tenantId") DO NOTHING`;

  const rows = await tx.$queryRaw<{ n: number; prefix: string | null; padLength: number }[]>`
    UPDATE "EmployeeNumberCounter"
    SET "nextNumber" = "nextNumber" + 1, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "tenantId" = ${tenantId}::uuid
    RETURNING "nextNumber" - 1 AS "n", "prefix", "padLength"`;

  const { n, prefix, padLength } = rows[0]!;
  return formatEmployeeNumber(n, prefix, padLength);
}
