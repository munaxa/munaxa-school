import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

export type FinanceDimension = 'academicYear' | 'grade' | 'campus' | 'category';

/** One aggregated row of the dimensional finance report. */
export interface DimensionRow {
  dimId: string | null;
  label: string;
  gross: string;
  discount: string;
  net: string;
  paid: string;
  outstanding: string;
  chargeCount: number;
}

/** The finance workspace's account-centric overview (dashboard). All figures are tenant-wide SQL
 * aggregates over the ledger — never per-account loops. Money is the Financial Account's; students
 * never appear as a dashboard dimension (finance is account-centric). */
export interface FinanceOverview {
  kpis: {
    totalOutstanding: string;
    collectedToday: string;
    collectedThisMonth: string;
    overdueAccounts: number;
    pendingInstallments: number;
    activePaymentPlans: number;
  };
  largestOutstandingAccounts: Array<{
    payerId: string;
    name: string;
    outstanding: string;
    nextDueDate: string | null;
    nextDueAmount: string | null;
    collectionStatus: 'NONE' | 'FINANCIAL_ISSUE' | 'LEGAL';
  }>;
  recentPayments: Array<{
    id: string;
    payerId: string | null;
    accountName: string;
    amount: string;
    method: string;
    at: string | null;
    receiptNo: number | null;
  }>;
  upcomingInstallments: Array<{
    payerId: string;
    accountName: string;
    dueDate: string | null;
    amount: string;
  }>;
}

/** Column + label join for each supported reporting dimension (RR-2/RR-3). */
const DIMENSION_SQL: Record<
  FinanceDimension,
  { column: string; joinTable: string; joinAlias: string; labelExpr: string }
> = {
  academicYear: {
    column: 'academicYearId',
    joinTable: 'AcademicYear',
    joinAlias: 'ay',
    labelExpr: 'ay.name',
  },
  grade: { column: 'gradeId', joinTable: 'Grade', joinAlias: 'g', labelExpr: 'g."nameEn"' },
  campus: { column: 'campusId', joinTable: 'Campus', joinAlias: 'cm', labelExpr: 'cm.name' },
  category: {
    column: 'feeItemId',
    joinTable: 'FeeItem',
    joinAlias: 'fi',
    labelExpr: 'fi."nameEn"',
  },
};

/**
 * Read-side dimensional finance reporting (RR-1: never reads write-model internals directly — it
 * aggregates the ledger). Revenue (gross/discount/net), collected (paid) and outstanding grouped
 * by academic year / grade / campus / fee category. One RLS-scoped SQL statement (efficient); every
 * figure is derived from the same source rows as the ledger (single source of truth).
 */
@Injectable()
export class FinanceReportsRepository extends TenantRepository {
  summaryByDimension(dimension: FinanceDimension): Promise<DimensionRow[]> {
    const dim = DIMENSION_SQL[dimension];
    if (!dim) throw new BadRequestException('Unsupported dimension');
    // Column/table/alias come from a fixed whitelist above (never user input) — safe to interpolate.
    const sql = Prisma.sql`
      WITH ch AS (
        SELECT id, "${Prisma.raw(dim.column)}" AS dim_id, amount
        FROM "Charge"
        WHERE status NOT IN ('CANCELLED', 'WRITTEN_OFF')
      ),
      disc AS (
        SELECT "chargeId", SUM(amount) AS s
        FROM "FeeAdjustment"
        WHERE status = 'APPLIED' AND "chargeId" IS NOT NULL
        GROUP BY "chargeId"
      ),
      pay AS (
        SELECT i."chargeId", SUM(pa.amount) AS s
        FROM "PaymentAllocation" pa
        JOIN "Installment" i ON i.id = pa."installmentId"
        WHERE pa."reversedAt" IS NULL
        GROUP BY i."chargeId"
      )
      SELECT
        ch.dim_id AS "dimId",
        COALESCE(${Prisma.raw(dim.labelExpr)}, '—') AS label,
        SUM(ch.amount)::text AS gross,
        COALESCE(SUM(disc.s), 0)::text AS discount,
        (SUM(ch.amount) - COALESCE(SUM(disc.s), 0))::text AS net,
        COALESCE(SUM(pay.s), 0)::text AS paid,
        (SUM(ch.amount) - COALESCE(SUM(disc.s), 0) - COALESCE(SUM(pay.s), 0))::text AS outstanding,
        COUNT(DISTINCT ch.id)::int AS "chargeCount"
      FROM ch
      LEFT JOIN disc ON disc."chargeId" = ch.id
      LEFT JOIN pay ON pay."chargeId" = ch.id
      LEFT JOIN "${Prisma.raw(dim.joinTable)}" ${Prisma.raw(dim.joinAlias)}
        ON ${Prisma.raw(dim.joinAlias)}.id = ch.dim_id
      GROUP BY ch.dim_id, ${Prisma.raw(dim.labelExpr)}
      ORDER BY outstanding DESC
    `;
    return this.run((tx) => tx.$queryRaw<DimensionRow[]>(sql));
  }

  /**
   * Outstanding / collection report grouped by FAMILY (financial account) — the finance-first default —
   * or by STUDENT (drill-down). Every figure derives from the same ledger rows as summaryByDimension
   * (single source of truth): net = Σ charge − Σ discount, paid = Σ active allocations, outstanding =
   * net − paid. Account rows join Charge → its student account → Payer (the Financial Account);
   * students with no account fall under an "Unassigned" row (dimId null).
   */
  outstandingBy(groupBy: 'family' | 'student'): Promise<DimensionRow[]> {
    const isFamily = groupBy === 'family';
    // dim_id + label sources are fixed (never user input) — safe to interpolate.
    const dimIdExpr = isFamily ? 'sfa."payerId"' : 'ch."studentId"';
    const labelJoin = isFamily
      ? Prisma.sql`LEFT JOIN "Payer" fa ON fa.id = base.dim_id`
      : Prisma.sql`LEFT JOIN "Student" st ON st.id = base.dim_id`;
    const labelExpr = isFamily
      ? Prisma.sql`COALESCE(fa."nameEn", 'Unassigned')`
      : Prisma.sql`COALESCE(TRIM(st."firstNameEn" || ' ' || st."lastNameEn"), 'Unknown')`;
    const sql = Prisma.sql`
      WITH base AS (
        SELECT ch.id, ${Prisma.raw(dimIdExpr)} AS dim_id, ch.amount
        FROM "Charge" ch
        JOIN "StudentFinancialAccount" sfa ON sfa.id = ch."accountId"
        WHERE ch.status NOT IN ('CANCELLED', 'WRITTEN_OFF')
      ),
      disc AS (
        SELECT "chargeId", SUM(amount) AS s FROM "FeeAdjustment"
        WHERE status = 'APPLIED' AND "chargeId" IS NOT NULL GROUP BY "chargeId"
      ),
      pay AS (
        SELECT i."chargeId", SUM(pa.amount) AS s
        FROM "PaymentAllocation" pa JOIN "Installment" i ON i.id = pa."installmentId"
        WHERE pa."reversedAt" IS NULL GROUP BY i."chargeId"
      )
      SELECT
        base.dim_id AS "dimId",
        ${labelExpr} AS label,
        SUM(base.amount)::text AS gross,
        COALESCE(SUM(disc.s), 0)::text AS discount,
        (SUM(base.amount) - COALESCE(SUM(disc.s), 0))::text AS net,
        COALESCE(SUM(pay.s), 0)::text AS paid,
        (SUM(base.amount) - COALESCE(SUM(disc.s), 0) - COALESCE(SUM(pay.s), 0))::text AS outstanding,
        COUNT(DISTINCT base.id)::int AS "chargeCount"
      FROM base
      LEFT JOIN disc ON disc."chargeId" = base.id
      LEFT JOIN pay ON pay."chargeId" = base.id
      ${labelJoin}
      GROUP BY base.dim_id, ${labelExpr}
      ORDER BY outstanding DESC
    `;
    return this.run((tx) => tx.$queryRaw<DimensionRow[]>(sql));
  }

  /**
   * Account-centric finance overview for the unified workspace dashboard. Every widget is a
   * tenant-wide, RLS-scoped SQL aggregate over the ledger (no per-account fan-out, no cache): KPI
   * headline, largest-outstanding ACCOUNTS (never students), recent payments, and the soonest-due
   * account installments (Σ per account+date — the account's Billing Schedule shape).
   */
  async financeOverview(limit = 8): Promise<FinanceOverview> {
    // Shared ledger CTEs: per-charge discount and active-allocation (paid) sums.
    const discPay = Prisma.sql`
      disc AS (
        SELECT "chargeId", SUM(amount) AS s FROM "FeeAdjustment"
        WHERE status = 'APPLIED' AND "chargeId" IS NOT NULL GROUP BY "chargeId"
      ),
      pay AS (
        SELECT i."chargeId", SUM(pa.amount) AS s
        FROM "PaymentAllocation" pa JOIN "Installment" i ON i.id = pa."installmentId"
        WHERE pa."reversedAt" IS NULL GROUP BY i."chargeId"
      )`;

    return this.run(async (tx) => {
      const [kpiRow] = await tx.$queryRaw<
        Array<{
          totalOutstanding: string;
          collectedToday: string;
          collectedThisMonth: string;
          overdueAccounts: number;
          pendingInstallments: number;
          activePaymentPlans: number;
        }>
      >(Prisma.sql`
        WITH ${discPay},
        outstanding AS (
          SELECT COALESCE(SUM(ch.amount - COALESCE(disc.s, 0) - COALESCE(pay.s, 0)), 0) AS total
          FROM "Charge" ch
          LEFT JOIN disc ON disc."chargeId" = ch.id
          LEFT JOIN pay ON pay."chargeId" = ch.id
          WHERE ch.status NOT IN ('CANCELLED', 'WRITTEN_OFF')
        )
        SELECT
          (SELECT total FROM outstanding)::text AS "totalOutstanding",
          (SELECT COALESCE(SUM(amount), 0) FROM "Payment"
             WHERE status = 'VERIFIED' AND "verifiedAt" >= date_trunc('day', now()))::text AS "collectedToday",
          (SELECT COALESCE(SUM(amount), 0) FROM "Payment"
             WHERE status = 'VERIFIED' AND "verifiedAt" >= date_trunc('month', now()))::text AS "collectedThisMonth",
          (SELECT COUNT(DISTINCT sfa."payerId") FROM "Installment" i
             JOIN "Charge" c ON c.id = i."chargeId"
             JOIN "StudentFinancialAccount" sfa ON sfa.id = c."accountId"
             WHERE i.status IN ('SCHEDULED', 'PARTIAL') AND i."dueDate" < CURRENT_DATE
               AND sfa."payerId" IS NOT NULL)::int AS "overdueAccounts",
          (SELECT COUNT(*) FROM "Installment" WHERE status IN ('SCHEDULED', 'PARTIAL'))::int AS "pendingInstallments",
          (SELECT COUNT(DISTINCT sfa."payerId") FROM "PaymentPlan" pp
             JOIN "Charge" c ON c.id = pp."chargeId"
             JOIN "StudentFinancialAccount" sfa ON sfa.id = c."accountId"
             WHERE pp.status = 'ACTIVE' AND sfa."payerId" IS NOT NULL)::int AS "activePaymentPlans"
      `);

      const largest = await tx.$queryRaw<
        Array<{
          payerId: string;
          name: string;
          outstanding: string;
          nextDueDate: Date | null;
          nextDueAmount: string | null;
          caseStatus: string | null;
        }>
      >(Prisma.sql`
        WITH ${discPay},
        base AS (
          SELECT sfa."payerId" AS payer_id, ch.id AS charge_id, ch.amount
          FROM "Charge" ch
          JOIN "StudentFinancialAccount" sfa ON sfa.id = ch."accountId"
          WHERE ch.status NOT IN ('CANCELLED', 'WRITTEN_OFF') AND sfa."payerId" IS NOT NULL
        ),
        agg AS (
          SELECT base.payer_id,
            SUM(base.amount) - COALESCE(SUM(disc.s), 0) - COALESCE(SUM(pay.s), 0) AS outstanding
          FROM base
          LEFT JOIN disc ON disc."chargeId" = base.charge_id
          LEFT JOIN pay ON pay."chargeId" = base.charge_id
          GROUP BY base.payer_id
        )
        SELECT agg.payer_id AS "payerId", COALESCE(p."nameEn", '—') AS name,
          agg.outstanding::text AS outstanding,
          nd.due_date AS "nextDueDate", nd.amount::text AS "nextDueAmount",
          cc.status::text AS "caseStatus"
        FROM agg
        JOIN "Payer" p ON p.id = agg.payer_id
        LEFT JOIN LATERAL (
          SELECT i."dueDate" AS due_date, SUM(i.amount) AS amount
          FROM "Installment" i
          JOIN "Charge" c2 ON c2.id = i."chargeId"
          JOIN "StudentFinancialAccount" s2 ON s2.id = c2."accountId"
          WHERE s2."payerId" = agg.payer_id AND i.status IN ('SCHEDULED', 'PARTIAL')
            AND i."dueDate" IS NOT NULL AND i."dueDate" >= CURRENT_DATE
          GROUP BY i."dueDate" ORDER BY i."dueDate" ASC LIMIT 1
        ) nd ON true
        LEFT JOIN "CollectionsCase" cc ON cc."payerId" = agg.payer_id
        WHERE agg.outstanding > 0
        ORDER BY agg.outstanding DESC
        LIMIT ${limit}
      `);

      const recentPayments = await tx.$queryRaw<
        Array<{
          id: string;
          payerId: string | null;
          accountName: string;
          amount: string;
          method: string;
          at: Date | null;
          receiptNo: number | null;
        }>
      >(Prisma.sql`
        SELECT pay.id, pay."payerId" AS "payerId", COALESCE(p."nameEn", '—') AS "accountName",
          pay.amount::text AS amount, pay.method::text AS method,
          pay."verifiedAt" AS at, pay."receiptNo" AS "receiptNo"
        FROM "Payment" pay
        LEFT JOIN "Payer" p ON p.id = pay."payerId"
        WHERE pay.status = 'VERIFIED'
        ORDER BY pay."verifiedAt" DESC NULLS LAST
        LIMIT ${limit}
      `);

      const upcomingInstallments = await tx.$queryRaw<
        Array<{ payerId: string; accountName: string; dueDate: Date | null; amount: string }>
      >(Prisma.sql`
        SELECT sfa."payerId" AS "payerId", COALESCE(p."nameEn", '—') AS "accountName",
          i."dueDate" AS "dueDate", SUM(i.amount)::text AS amount
        FROM "Installment" i
        JOIN "Charge" c ON c.id = i."chargeId"
        JOIN "StudentFinancialAccount" sfa ON sfa.id = c."accountId"
        LEFT JOIN "Payer" p ON p.id = sfa."payerId"
        WHERE i.status IN ('SCHEDULED', 'PARTIAL') AND i."dueDate" >= CURRENT_DATE
          AND sfa."payerId" IS NOT NULL
        GROUP BY sfa."payerId", p."nameEn", i."dueDate"
        ORDER BY i."dueDate" ASC
        LIMIT ${limit}
      `);

      const mapCase = (s: string | null): 'NONE' | 'FINANCIAL_ISSUE' | 'LEGAL' =>
        s === 'LEGAL' ? 'LEGAL' : s && s !== 'RESOLVED' ? 'FINANCIAL_ISSUE' : 'NONE';

      return {
        kpis: {
          totalOutstanding: kpiRow?.totalOutstanding ?? '0',
          collectedToday: kpiRow?.collectedToday ?? '0',
          collectedThisMonth: kpiRow?.collectedThisMonth ?? '0',
          overdueAccounts: Number(kpiRow?.overdueAccounts ?? 0),
          pendingInstallments: Number(kpiRow?.pendingInstallments ?? 0),
          activePaymentPlans: Number(kpiRow?.activePaymentPlans ?? 0),
        },
        largestOutstandingAccounts: largest.map((r) => ({
          payerId: r.payerId,
          name: r.name,
          outstanding: r.outstanding,
          nextDueDate: r.nextDueDate ? r.nextDueDate.toISOString() : null,
          nextDueAmount: r.nextDueAmount,
          collectionStatus: mapCase(r.caseStatus),
        })),
        recentPayments: recentPayments.map((r) => ({
          id: r.id,
          payerId: r.payerId,
          accountName: r.accountName,
          amount: r.amount,
          method: r.method,
          at: r.at ? r.at.toISOString() : null,
          receiptNo: r.receiptNo,
        })),
        upcomingInstallments: upcomingInstallments.map((r) => ({
          payerId: r.payerId,
          accountName: r.accountName,
          dueDate: r.dueDate ? r.dueDate.toISOString() : null,
          amount: r.amount,
        })),
      };
    });
  }
}
