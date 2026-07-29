import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantRepository } from '../common/tenant.repository';

const ZERO = new Prisma.Decimal(0);
const TREND_DAYS = 7;
const SPARK_MONTHS = 6;

export interface DashboardOverview {
  students: number;
  staff: number;
  attendanceToday: {
    present: number;
    late: number;
    absent: number;
    excused: number;
    total: number;
  };
  /** Financial figures — `null` when the caller lacks `finance:read` (never sent over the wire). */
  finance: {
    billed: string;
    discounts: string;
    paid: string;
    outstanding: string;
    overdue: string;
    collectedThisMonth: string;
  } | null;
  /** e-Invoice status counts — `null` when the caller lacks `finance:read`. */
  einvoice: { accepted: number; pending: number; rejected: number } | null;
  /** Daily student-attendance rate for the last {@link TREND_DAYS} days (oldest first). */
  attendanceTrend: Array<{
    date: string;
    present: number;
    late: number;
    absent: number;
    excused: number;
    total: number;
    rate: number | null;
  }>;
  /** Active student headcount per grade level (ascending). */
  studentsByGrade: Array<{ level: number; nameEn: string; nameAr: string; students: number }>;
  /** Month-to-date movement, for KPI deltas. */
  deltas: { studentsThisMonth: number; staffThisMonth: number };
  /** New-record counts per month for the last {@link SPARK_MONTHS} months (oldest first). */
  sparklines: { students: number[]; staff: number[] };
  recentActivity: Array<{
    action: string;
    entityType: string;
    entityId: string | null;
    actorName: string | null;
    actorUsername: string | null;
    actorRole: string | null;
    ip: string | null;
    at: string;
  }>;
}

/** Bucket `date_trunc('month')` rows into a fixed-length per-month series ending at the current month. */
function monthlyBuckets(
  rows: Array<{ m: Date; count: bigint }>,
  months: number,
  baseMonth: Date,
): number[] {
  const series = new Array<number>(months).fill(0);
  for (const r of rows) {
    const d = new Date(r.m);
    const idx =
      (d.getUTCFullYear() - baseMonth.getUTCFullYear()) * 12 +
      (d.getUTCMonth() - baseMonth.getUTCMonth());
    if (idx >= 0 && idx < months) series[idx] = Number(r.count);
  }
  return series;
}

/** Read-only tenant-wide aggregates for the admin dashboard (RLS-scoped like everything else). */
@Injectable()
export class DashboardRepository extends TenantRepository {
  /**
   * Records (audits) a reveal of masked financial figures. The figures themselves are already
   * authorised (the endpoint requires `finance:read`); this writes the who/what/when to the audit
   * trail so every unmask of sensitive money is accountable.
   */
  recordReveal(input: {
    actorUserId: string;
    actorRole: string | null;
    scope: string;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<void> {
    return this.run(async (tx, tenantId) => {
      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId: input.actorUserId,
          actorRole: input.actorRole ?? undefined,
          action: 'finance.reveal',
          entityType: 'Dashboard',
          entityId: input.scope,
          metadata: { scope: input.scope },
          ip: input.ip ?? undefined,
          userAgent: input.userAgent ?? undefined,
        },
      });
    });
  }

  /**
   * @param includeFinance whether the caller holds `finance:read`. When false the `finance` and
   * `einvoice` blocks are returned as `null` so sensitive money never leaves the server.
   */
  overview(includeFinance: boolean): Promise<DashboardOverview> {
    return this.run(async (tx, tenantId) => {
      const now = new Date();
      const todayUtc = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const trendStart = new Date(todayUtc);
      trendStart.setUTCDate(trendStart.getUTCDate() - (TREND_DAYS - 1));
      // First day of the oldest sparkline month (current month minus SPARK_MONTHS-1).
      const sparkStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (SPARK_MONTHS - 1), 1),
      );

      const [
        students,
        staff,
        attendanceGroups,
        attendanceTrendGroups,
        grades,
        billedAgg,
        discountAgg,
        paidAgg,
        overdueAgg,
        monthAgg,
        studentsThisMonth,
        staffThisMonth,
        studentSpark,
        staffSpark,
        einvoiceGroups,
        activity,
      ] = await Promise.all([
        tx.student.count({ where: { tenantId, deletedAt: null } }),
        tx.teacher.count({ where: { tenantId, deletedAt: null } }),
        tx.studentAttendance.groupBy({
          by: ['status'],
          where: { tenantId, date: todayUtc },
          _count: true,
        }),
        tx.studentAttendance.groupBy({
          by: ['date', 'status'],
          where: { tenantId, date: { gte: trendStart, lte: todayUtc } },
          _count: true,
        }),
        tx.grade.findMany({
          where: { tenantId },
          select: { nameEn: true, nameAr: true, level: true, sections: { select: { id: true } } },
          orderBy: { level: 'asc' },
        }),
        tx.charge.aggregate({
          where: { tenantId, status: { not: 'CANCELLED' } },
          _sum: { amount: true },
        }),
        tx.feeAdjustment.aggregate({
          where: { tenantId, status: 'APPLIED' },
          _sum: { amount: true },
        }),
        tx.payment.aggregate({
          where: { tenantId, status: 'VERIFIED' },
          _sum: { amount: true },
        }),
        tx.charge.aggregate({
          where: { tenantId, status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { lt: todayUtc } },
          _sum: { amount: true },
        }),
        tx.payment.aggregate({
          where: { tenantId, status: 'VERIFIED', createdAt: { gte: startOfMonth } },
          _sum: { amount: true },
        }),
        tx.student.count({
          where: { tenantId, deletedAt: null, enrollmentDate: { gte: startOfMonth } },
        }),
        tx.teacher.count({
          where: { tenantId, deletedAt: null, createdAt: { gte: startOfMonth } },
        }),
        tx.$queryRaw<Array<{ m: Date; count: bigint }>>`
          SELECT date_trunc('month', "enrollmentDate") AS m, count(*)::bigint AS count
          FROM "Student"
          WHERE "tenantId" = ${tenantId}::uuid AND "deletedAt" IS NULL AND "enrollmentDate" >= ${sparkStart}
          GROUP BY 1 ORDER BY 1 ASC
        `,
        tx.$queryRaw<Array<{ m: Date; count: bigint }>>`
          SELECT date_trunc('month', "createdAt") AS m, count(*)::bigint AS count
          FROM "Teacher"
          WHERE "tenantId" = ${tenantId}::uuid AND "deletedAt" IS NULL AND "createdAt" >= ${sparkStart}
          GROUP BY 1 ORDER BY 1 ASC
        `,
        tx.eInvoiceDocument.groupBy({ by: ['status'], where: { tenantId }, _count: true }),
        tx.auditLog.findMany({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: {
            action: true,
            entityType: true,
            entityId: true,
            actorRole: true,
            metadata: true,
            ip: true,
            createdAt: true,
            actor: {
              select: { firstNameEn: true, lastNameEn: true, username: true, email: true },
            },
          },
        }),
      ]);

      const att = { present: 0, late: 0, absent: 0, excused: 0, total: 0 };
      for (const g of attendanceGroups) {
        const n = typeof g._count === 'number' ? g._count : 0;
        att.total += n;
        if (g.status === 'PRESENT') att.present = n;
        else if (g.status === 'LATE') att.late = n;
        else if (g.status === 'ABSENT') att.absent = n;
        else if (g.status === 'EXCUSED') att.excused = n;
      }

      // Build a contiguous TREND_DAYS-long series so gaps render as empty days.
      const trendByDay = new Map<
        string,
        { present: number; late: number; absent: number; excused: number; total: number }
      >();
      for (const g of attendanceTrendGroups) {
        const key = new Date(g.date).toISOString().slice(0, 10);
        const bucket = trendByDay.get(key) ?? {
          present: 0,
          late: 0,
          absent: 0,
          excused: 0,
          total: 0,
        };
        const n = typeof g._count === 'number' ? g._count : 0;
        bucket.total += n;
        if (g.status === 'PRESENT') bucket.present += n;
        else if (g.status === 'LATE') bucket.late += n;
        else if (g.status === 'ABSENT') bucket.absent += n;
        else if (g.status === 'EXCUSED') bucket.excused += n;
        trendByDay.set(key, bucket);
      }
      const attendanceTrend = Array.from({ length: TREND_DAYS }, (_, i) => {
        const day = new Date(trendStart);
        day.setUTCDate(day.getUTCDate() + i);
        const key = day.toISOString().slice(0, 10);
        const b = trendByDay.get(key) ?? {
          present: 0,
          late: 0,
          absent: 0,
          excused: 0,
          total: 0,
        };
        return {
          date: key,
          ...b,
          rate: b.total > 0 ? Math.round(((b.present + b.late) / b.total) * 100) : null,
        };
      });

      // Per-grade headcount aggregated by level (collapses the same level across campuses).
      const sectionToLevel = new Map<string, number>();
      const byLevel = new Map<
        number,
        { level: number; nameEn: string; nameAr: string; students: number }
      >();
      for (const g of grades) {
        if (!byLevel.has(g.level)) {
          byLevel.set(g.level, { level: g.level, nameEn: g.nameEn, nameAr: g.nameAr, students: 0 });
        }
        for (const s of g.sections) sectionToLevel.set(s.id, g.level);
      }
      const sectionIds = [...sectionToLevel.keys()];
      const studentsBySection = sectionIds.length
        ? await tx.student.groupBy({
            by: ['sectionId'],
            where: { tenantId, deletedAt: null, sectionId: { in: sectionIds } },
            _count: true,
          })
        : [];
      for (const row of studentsBySection) {
        const level = row.sectionId ? sectionToLevel.get(row.sectionId) : undefined;
        if (level === undefined) continue;
        const n = typeof row._count === 'number' ? row._count : 0;
        const entry = byLevel.get(level);
        if (entry) entry.students += n;
      }
      const studentsByGrade = [...byLevel.values()].sort((a, b) => a.level - b.level);

      const billed = billedAgg._sum.amount ?? ZERO;
      const discounts = discountAgg._sum.amount ?? ZERO;
      const paid = paidAgg._sum.amount ?? ZERO;
      const outstanding = Prisma.Decimal.max(billed.minus(discounts).minus(paid), ZERO);
      // Overdue is the portion of the outstanding balance tied to past-due charges; cap it at the
      // overall outstanding so the collected/pending/overdue split never exceeds the total.
      const overdue = Prisma.Decimal.min(overdueAgg._sum.amount ?? ZERO, outstanding);

      const einvoice = { accepted: 0, pending: 0, rejected: 0 };
      for (const g of einvoiceGroups) {
        const n = typeof g._count === 'number' ? g._count : 0;
        if (g.status === 'ACCEPTED') einvoice.accepted += n;
        else if (g.status === 'REJECTED' || g.status === 'DEAD_LETTER') einvoice.rejected += n;
        else if (g.status === 'QUEUED' || g.status === 'SUBMITTING' || g.status === 'DRAFT')
          einvoice.pending += n;
      }

      return {
        students,
        staff,
        attendanceToday: att,
        // Finance is permission-gated: omitted entirely (null) for callers without finance:read.
        finance: includeFinance
          ? {
              billed: billed.toFixed(3),
              discounts: discounts.toFixed(3),
              paid: paid.toFixed(3),
              outstanding: outstanding.toFixed(3),
              overdue: overdue.toFixed(3),
              collectedThisMonth: (monthAgg._sum.amount ?? ZERO).toFixed(3),
            }
          : null,
        einvoice: includeFinance ? einvoice : null,
        attendanceTrend,
        studentsByGrade,
        deltas: { studentsThisMonth, staffThisMonth },
        sparklines: {
          students: monthlyBuckets(studentSpark, SPARK_MONTHS, sparkStart),
          staff: monthlyBuckets(staffSpark, SPARK_MONTHS, sparkStart),
        },
        recentActivity: activity.map((a) => {
          const actor = a.actor;
          const fullName = actor
            ? `${actor.firstNameEn ?? ''} ${actor.lastNameEn ?? ''}`.trim()
            : '';
          // Failed logins for an unknown handle have no actor — surface the attempted identifier.
          const meta =
            a.metadata && typeof a.metadata === 'object' && !Array.isArray(a.metadata)
              ? (a.metadata as Record<string, unknown>)
              : {};
          const attempted = typeof meta.identifier === 'string' ? meta.identifier : null;
          return {
            action: a.action,
            entityType: a.entityType,
            entityId: a.entityId ?? null,
            actorName: fullName || null,
            actorUsername: actor?.username ?? actor?.email ?? attempted,
            actorRole: a.actorRole ?? null,
            ip: a.ip ?? null,
            at: a.createdAt.toISOString(),
          };
        }),
      };
    });
  }
}
