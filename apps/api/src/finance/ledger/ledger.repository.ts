import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type Charge,
  type Credit,
  type FeeAdjustment,
  type Installment,
  type PaymentAllocation,
  type PaymentPlan,
  type Refund,
} from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';
import { TenantContextStore } from '../../prisma/tenant-context';
import type { TxClient } from '../../prisma/tenant.helpers';
import { ZERO, floorZero, toFils, fromFils } from '../shared/money';

/** One fee line within a Billing Schedule row (a single student's installment for one charge). */
export interface BillingScheduleLine {
  installmentId: string;
  studentId: string;
  studentName: string;
  chargeDescription: string;
  amount: string;
  paid: string;
  balance: string;
  status: 'PAID' | 'PARTIAL' | 'OVERDUE' | 'UPCOMING';
}

/** One row of the account Billing Schedule: everything due on a single date, across all students. */
export interface BillingScheduleRow {
  dueDate: string | null;
  amount: string;
  paid: string;
  balance: string;
  status: 'PAID' | 'PARTIAL' | 'OVERDUE' | 'UPCOMING';
  lines: BillingScheduleLine[];
}

/** The Financial Account's Billing Schedule — the account's single, dynamically merged plan view. */
export interface BillingSchedule {
  rows: BillingScheduleRow[];
  totals: { amount: string; paid: string; balance: string };
}

/** Per-installment derived figures (LR-2). */
export interface InstallmentView {
  id: string;
  seq: number;
  dueDate: Date | null;
  amount: string;
  paid: string;
  balance: string;
  status: string;
  overdue: boolean; // derived (BR-16), never stored
}

/** A superseded/completed plan retained for history (never in the default schedule). */
export interface PlanHistoryView {
  id: string;
  cadence: string;
  count: number; // plan.installments (the planned count)
  firstDueDate: Date;
  balloonFinal: boolean;
  status: string;
  scheduled: string; // Σ retained (non-cancelled) installment amounts on this plan
  paid: string; // Σ paid to this plan's installments
  lines: InstallmentView[];
}

/** Per-charge derived figures + its plan/installments (LR-1, LR-3). */
export interface ChargeView {
  charge: Charge;
  gross: string;
  discount: string;
  net: string;
  paid: string;
  balance: string;
  /** The single ACTIVE plan (BR-11) — at most one per charge. */
  plan: {
    id: string;
    cadence: string;
    installments: number;
    firstDueDate: Date;
    balloonFinal: boolean;
    status: string;
  } | null;
  /** Only the ACTIVE plan's installments (the default schedule view). */
  installments: InstallmentView[];
  /** Superseded/completed plans + their retained installments, for a history/audit view. */
  history: PlanHistoryView[];
  /**
   * For an aggregate charge (e.g. "Tuition & fees" covering several fee lines) the underlying fee
   * breakdown, reconstructed from the enrollment quote, so the UI can show the details then the sum.
   * Empty for single-line charges (which already are their own detail).
   */
  lineItems: ChargeLineItem[];
}

/** One underlying fee line of an aggregate charge (net of its own discount). */
export interface ChargeLineItem {
  label: string;
  amount: string;
}

/** Account-level derived figures — the numbers behind the statement (LR-4..6). */
export interface AccountSummary {
  charged: string; // Σ charge gross (status ∉ CANCELLED/WRITTEN_OFF)
  discounts: string; // Σ APPLIED charge-scoped adjustments
  netCharged: string; // charged − discounts
  paid: string; // Σ installment.paid (≡ Σ active allocations)
  outstanding: string; // Σ charge.balance
  creditBalance: string; // Σ Credit.remaining
  refunded: string; // Σ verified refunds
}

/** Family/customer-level derived figures — the KPIs behind the Family Finance Dashboard. */
export interface FinancialAccountSummary extends AccountSummary {
  nextDue: { dueDate: string; amount: string } | null;
  lastPayment: { date: string; amount: string } | null;
  collectionStatus: 'NONE' | 'FINANCIAL_ISSUE' | 'LEGAL';
  childrenCount: number;
}

const isToday = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Data access + **derived-figure computation** for the AR ledger (the single source of truth for
 * every calculation — Ledger Rules LR-1..9). Nothing is denormalised: charge/installment/account
 * figures are recomputed from child rows inside the active transaction, and installment→charge
 * status is recomputed on every allocation/adjustment. All financial writes emit an AuditLog in
 * the same transaction (AU-1).
 */
@Injectable()
export class LedgerRepository extends TenantRepository {
  private actor(): string | null {
    return TenantContextStore.get()?.actorUserId ?? null;
  }

  /** Batch: active-allocation sum per installment id (one query — avoids N+1). */
  private async paidByInstallment(
    tx: TxClient,
    ids: string[],
  ): Promise<Map<string, Prisma.Decimal>> {
    if (ids.length === 0) return new Map();
    const rows = await tx.paymentAllocation.groupBy({
      by: ['installmentId'],
      where: { installmentId: { in: ids }, reversedAt: null },
      _sum: { amount: true },
    });
    return new Map(rows.map((r) => [r.installmentId, r._sum.amount ?? ZERO]));
  }

  /** Batch: consumed sum per credit id (one query). */
  private async consumedByCredit(
    tx: TxClient,
    ids: string[],
  ): Promise<Map<string, Prisma.Decimal>> {
    if (ids.length === 0) return new Map();
    const rows = await tx.refundConsumption.groupBy({
      by: ['creditId'],
      where: { creditId: { in: ids } },
      _sum: { amount: true },
    });
    return new Map(rows.map((r) => [r.creditId, r._sum.amount ?? ZERO]));
  }

  // ─────────────────────────────────────────────────────────── status recompute

  /** Recompute a single installment's status from its active allocations (LR-9). */
  private async recomputeInstallment(tx: TxClient, installmentId: string): Promise<void> {
    const inst = await tx.installment.findFirst({ where: { id: installmentId } });
    if (!inst || inst.status === 'CANCELLED' || inst.status === 'WAIVED') return;
    const agg = await tx.paymentAllocation.aggregate({
      where: { installmentId, reversedAt: null },
      _sum: { amount: true },
    });
    const paid = agg._sum.amount ?? ZERO;
    let status: Installment['status'];
    if (paid.greaterThanOrEqualTo(inst.amount)) status = 'PAID';
    else if (paid.greaterThan(ZERO)) status = 'PARTIAL';
    else status = 'SCHEDULED';
    if (status !== inst.status) {
      await tx.installment.update({ where: { id: installmentId }, data: { status } });
    }
  }

  /** Recompute a charge's status, rolled up from its installments + discounts (LR-9, §3.1). */
  private async recomputeCharge(tx: TxClient, chargeId: string): Promise<void> {
    const charge = await tx.charge.findFirst({ where: { id: chargeId } });
    if (!charge || charge.status === 'CANCELLED' || charge.status === 'WRITTEN_OFF') return;
    const [discountAgg, installments] = await Promise.all([
      tx.feeAdjustment.aggregate({
        where: { chargeId, status: 'APPLIED' },
        _sum: { amount: true },
      }),
      tx.installment.findMany({ where: { chargeId, status: { not: 'CANCELLED' } } }),
    ]);
    const discount = discountAgg._sum.amount ?? ZERO;
    const net = charge.amount.minus(discount);
    const paidBy = await this.paidByInstallment(
      tx,
      installments.map((i) => i.id),
    );
    const paid = installments.reduce((s, inst) => s.plus(paidBy.get(inst.id) ?? ZERO), ZERO);
    let status: Charge['status'];
    if (net.lessThanOrEqualTo(ZERO)) status = 'WAIVED';
    else if (paid.greaterThanOrEqualTo(net)) status = 'PAID';
    else if (paid.greaterThan(ZERO) || discount.greaterThan(ZERO)) status = 'PARTIAL';
    else status = 'PENDING';
    if (status !== charge.status) {
      await tx.charge.update({ where: { id: chargeId }, data: { status } });
    }
    // Complete the plan when everything is settled (§3.4).
    if (status === 'PAID' || status === 'WAIVED') {
      await tx.paymentPlan.updateMany({
        where: { chargeId, status: 'ACTIVE' },
        data: { status: 'COMPLETED' },
      });
    }
  }

  /**
   * Keep Σ installment.amount == charge.net after the net changes by `deltaFils` (a discount is
   * negative, a reversal positive). Discounts come off the unpaid tail (latest seq first),
   * cancelling installments that reach zero; reversals are added back to the last active
   * installment (BR-9). Only touches unpaid room — never reduces below what's already allocated.
   */
  private async rebalanceInstallments(
    tx: TxClient,
    chargeId: string,
    deltaFils: number,
  ): Promise<void> {
    if (deltaFils === 0) return;
    const installments = await tx.installment.findMany({
      where: { chargeId, status: { not: 'CANCELLED' } },
      orderBy: { seq: 'desc' },
    });
    if (installments.length === 0) return;

    if (deltaFils > 0) {
      // Net increased (discount reversed): add back to the last active installment.
      const last = installments[0]!;
      await tx.installment.update({
        where: { id: last.id },
        data: { amount: fromFils(toFils(last.amount) + deltaFils), status: 'SCHEDULED' },
      });
      await this.recomputeInstallment(tx, last.id);
      return;
    }

    // Net decreased: take |delta| off the unpaid tail.
    let remaining = -deltaFils;
    for (const inst of installments) {
      if (remaining <= 0) break;
      const alloc = await tx.paymentAllocation.aggregate({
        where: { installmentId: inst.id, reversedAt: null },
        _sum: { amount: true },
      });
      const paidFils = toFils(alloc._sum.amount ?? ZERO);
      const reducible = toFils(inst.amount) - paidFils;
      if (reducible <= 0) continue;
      const take = Math.min(remaining, reducible);
      const newAmountFils = toFils(inst.amount) - take;
      if (newAmountFils === 0 && paidFils === 0) {
        await tx.installment.update({
          where: { id: inst.id },
          data: { amount: ZERO, status: 'CANCELLED' },
        });
      } else {
        await tx.installment.update({
          where: { id: inst.id },
          data: { amount: fromFils(newAmountFils) },
        });
        await this.recomputeInstallment(tx, inst.id);
      }
      remaining -= take;
    }
  }

  // ─────────────────────────────────────────────────────────── derived reads

  /** Per-charge views (with plan + installments) for a student, active charges first (LR-1..3). */
  chargeViews(studentId: string): Promise<ChargeView[]> {
    return this.run(async (tx) => {
      const charges = await tx.charge.findMany({
        where: { studentId },
        orderBy: { createdAt: 'asc' },
        include: {
          plans: { orderBy: { createdAt: 'desc' } },
          installments: { orderBy: { seq: 'asc' } },
        },
      });
      const today = isToday(new Date());

      // Aggregate "Tuition & fees" charges bundle several fee lines under one obligation. Reconstruct
      // their per-line breakdown from the enrollment quote (one batched query) so the statement can
      // show the details then the sum. The one-time registration fee is billed as its own charge, so
      // it is excluded here — the breakdown reconciles exactly to the aggregate charge's net.
      const aggregateEnrollmentIds = [
        ...new Set(
          charges
            .filter((c) => c.enrollmentId && c.description === 'Tuition & fees')
            .map((c) => c.enrollmentId as string),
        ),
      ];
      const lineItemsByEnrollment = new Map<string, ChargeLineItem[]>();
      if (aggregateEnrollmentIds.length > 0) {
        const enrollments = await tx.enrollment.findMany({
          where: { id: { in: aggregateEnrollmentIds } },
          select: { id: true, registrationFeePaid: true, quote: { select: { items: true } } },
        });
        for (const e of enrollments) {
          // When the registration fee was paid at registration it is a separate charge, so it is
          // excluded here; when it was folded into the plan it is part of this aggregate and stays in
          // the breakdown — either way the lines reconcile exactly to the charge's net.
          const items = (e.quote?.items ?? [])
            .filter((it) => !(e.registrationFeePaid && it.kind === 'REGISTRATION'))
            .map((it) => ({
              label: it.label,
              amount: it.amount.minus(it.discountAmount).toFixed(3),
            }));
          if (items.length > 0) lineItemsByEnrollment.set(e.id, items);
        }
      }
      return Promise.all(
        charges.map(async (c) => {
          const discountAgg = await tx.feeAdjustment.aggregate({
            where: { chargeId: c.id, status: 'APPLIED' },
            _sum: { amount: true },
          });
          const discount = discountAgg._sum.amount ?? ZERO;
          const net = c.amount.minus(discount);
          const activePlan = c.plans.find((p) => p.status === 'ACTIVE') ?? null;
          const paidBy = await this.paidByInstallment(
            tx,
            c.installments.map((i) => i.id),
          );
          const toView = (
            inst: Installment,
          ): { view: InstallmentView; instPaid: Prisma.Decimal } => {
            const instPaid = paidBy.get(inst.id) ?? ZERO;
            const balance = floorZero(inst.amount.minus(instPaid));
            return {
              instPaid,
              view: {
                id: inst.id,
                seq: inst.seq,
                dueDate: inst.dueDate,
                amount: inst.amount.toFixed(3),
                paid: instPaid.toFixed(3),
                balance: balance.toFixed(3),
                status: inst.status,
                overdue:
                  inst.status !== 'WAIVED' &&
                  balance.greaterThan(ZERO) &&
                  inst.dueDate != null &&
                  new Date(inst.dueDate) < today,
              },
            };
          };

          // Charge-level `paid` sums allocations across EVERY non-cancelled installment (all
          // plans) so retained payments on a superseded plan still count toward the balance.
          // The default schedule shows ONLY the active plan's installments; installments that
          // belong to a superseded/completed plan are surfaced under `history` (BR-11, §16).
          let paid = ZERO;
          const installments: InstallmentView[] = [];
          const historyLines = new Map<
            string,
            { view: InstallmentView; instPaid: Prisma.Decimal }[]
          >();
          for (const inst of c.installments) {
            if (inst.status === 'CANCELLED') continue;
            const built = toView(inst);
            paid = paid.plus(built.instPaid);
            const belongsToActive = activePlan
              ? inst.planId === activePlan.id
              : inst.planId == null;
            if (belongsToActive) {
              installments.push(built.view);
            } else if (inst.planId) {
              const list = historyLines.get(inst.planId) ?? [];
              list.push(built);
              historyLines.set(inst.planId, list);
            }
          }

          const history: PlanHistoryView[] = c.plans
            .filter((p) => p.id !== activePlan?.id)
            .map((p) => {
              const built = historyLines.get(p.id) ?? [];
              const scheduled = built.reduce(
                (s, b) => s.plus(new Prisma.Decimal(b.view.amount)),
                ZERO,
              );
              const planPaid = built.reduce((s, b) => s.plus(b.instPaid), ZERO);
              return {
                id: p.id,
                cadence: p.cadence,
                count: p.installments,
                firstDueDate: p.firstDueDate,
                balloonFinal: p.balloonFinal,
                status: p.status,
                scheduled: scheduled.toFixed(3),
                paid: planPaid.toFixed(3),
                lines: built.map((b) => b.view),
              };
            })
            .filter((h) => h.lines.length > 0);

          return {
            charge: c,
            gross: c.amount.toFixed(3),
            discount: discount.toFixed(3),
            net: net.toFixed(3),
            paid: paid.toFixed(3),
            balance: floorZero(net.minus(paid)).toFixed(3),
            plan: activePlan
              ? {
                  id: activePlan.id,
                  cadence: activePlan.cadence,
                  installments: activePlan.installments,
                  firstDueDate: activePlan.firstDueDate,
                  balloonFinal: activePlan.balloonFinal,
                  status: activePlan.status,
                }
              : null,
            installments,
            history,
            // Only the aggregate "Tuition & fees" charge carries a breakdown; sibling charges of the
            // same enrolment (e.g. the one-off registration fee) are already single-line.
            lineItems:
              c.enrollmentId && c.description === 'Tuition & fees'
                ? (lineItemsByEnrollment.get(c.enrollmentId) ?? [])
                : [],
          };
        }),
      );
    });
  }

  /** All open installments (with a positive balance) for a student — for collections/aging. */
  openInstallments(
    studentId: string,
  ): Promise<Array<{ id: string; dueDate: Date | null; balance: Prisma.Decimal }>> {
    return this.run(async (tx) => {
      const installments = await tx.installment.findMany({
        where: {
          charge: { studentId, status: { notIn: ['CANCELLED', 'WRITTEN_OFF'] } },
          status: { notIn: ['CANCELLED', 'WAIVED'] },
        },
        select: { id: true, dueDate: true, amount: true },
      });
      const paidBy = await this.paidByInstallment(
        tx,
        installments.map((i) => i.id),
      );
      const out: Array<{ id: string; dueDate: Date | null; balance: Prisma.Decimal }> = [];
      for (const inst of installments) {
        const balance = floorZero(inst.amount.minus(paidBy.get(inst.id) ?? ZERO));
        if (balance.greaterThan(ZERO)) out.push({ id: inst.id, dueDate: inst.dueDate, balance });
      }
      return out;
    });
  }

  /**
   * All open installments across a SET of students (the students billed through one financial
   * account), ordered by due date for cross-student FIFO allocation. Reuses the same open-balance
   * rule as {@link openInstallments}; the allocation policy is unchanged — it simply receives the
   * union of the family's installments (the declared CROSS_STUDENT seam, AR-8/ADR-005).
   */
  openInstallmentsForStudents(
    studentIds: string[],
  ): Promise<Array<{ id: string; dueDate: Date | null; balance: Prisma.Decimal }>> {
    return this.run(async (tx) => {
      if (studentIds.length === 0) return [];
      const installments = await tx.installment.findMany({
        where: {
          charge: {
            studentId: { in: studentIds },
            status: { notIn: ['CANCELLED', 'WRITTEN_OFF'] },
          },
          status: { notIn: ['CANCELLED', 'WAIVED'] },
        },
        select: { id: true, dueDate: true, amount: true, seq: true, chargeId: true },
        // Deterministic across students: due date, then charge, then seq.
        orderBy: [{ dueDate: 'asc' }, { chargeId: 'asc' }, { seq: 'asc' }],
      });
      const paidBy = await this.paidByInstallment(
        tx,
        installments.map((i) => i.id),
      );
      const out: Array<{ id: string; dueDate: Date | null; balance: Prisma.Decimal }> = [];
      for (const inst of installments) {
        const balance = floorZero(inst.amount.minus(paidBy.get(inst.id) ?? ZERO));
        if (balance.greaterThan(ZERO)) out.push({ id: inst.id, dueDate: inst.dueDate, balance });
      }
      return out;
    });
  }

  /**
   * Family/customer summary for the Family Finance Dashboard: the account's students' AR figures
   * rolled up (Σ per-student — same source rows as the per-student ledger, no parallel accounting)
   * plus family credit, next due, last payment, a collections rollup and the children count.
   */
  financialAccountSummary(payerId: string): Promise<FinancialAccountSummary> {
    return this.run(async (tx) => {
      const accounts = await tx.studentFinancialAccount.findMany({
        where: { payerId },
        select: { id: true, studentId: true },
      });
      const studentIds = accounts.map((a) => a.studentId);
      const empty: FinancialAccountSummary = {
        charged: '0.000',
        discounts: '0.000',
        netCharged: '0.000',
        paid: '0.000',
        outstanding: '0.000',
        creditBalance: '0.000',
        refunded: '0.000',
        nextDue: null,
        lastPayment: null,
        collectionStatus: 'NONE',
        childrenCount: studentIds.length,
      };
      if (studentIds.length === 0) return empty;

      const [chargeAgg, discountAgg, refundAgg, paidAgg] = await Promise.all([
        tx.charge.aggregate({
          where: { studentId: { in: studentIds }, status: { notIn: ['CANCELLED', 'WRITTEN_OFF'] } },
          _sum: { amount: true },
        }),
        tx.feeAdjustment.aggregate({
          where: { studentId: { in: studentIds }, status: 'APPLIED', chargeId: { not: null } },
          _sum: { amount: true },
        }),
        tx.refund.aggregate({
          where: { studentId: { in: studentIds }, status: 'VERIFIED' },
          _sum: { amount: true },
        }),
        tx.paymentAllocation.aggregate({
          where: { reversedAt: null, installment: { charge: { studentId: { in: studentIds } } } },
          _sum: { amount: true },
        }),
      ]);
      const charged = chargeAgg._sum.amount ?? ZERO;
      const discounts = discountAgg._sum.amount ?? ZERO;

      // Outstanding + next due from the union of open installments.
      const open = await this.openInstallmentsForStudents(studentIds);
      const outstanding = open.reduce((s, i) => s.plus(i.balance), ZERO);
      const dated = open
        .filter((i) => i.dueDate)
        .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
      const nextDue = dated[0]
        ? {
            dueDate: dated[0].dueDate!.toISOString().slice(0, 10),
            amount: dated[0].balance.toFixed(3),
          }
        : null;

      // Account credit: credit lots owned by the account (Payer), or by any of its students' accounts.
      const creditBalance = await this.financialAccountCreditBalanceTx(tx, payerId, studentIds);

      // Last verified payment across the account (by the account or any student).
      const lastPay = await tx.payment.findFirst({
        where: {
          status: 'VERIFIED',
          OR: [{ payerId }, { studentId: { in: studentIds } }],
        },
        orderBy: [{ verifiedAt: 'desc' }, { createdAt: 'desc' }],
        select: { amount: true, verifiedAt: true, createdAt: true },
      });
      const lastPayment = lastPay
        ? {
            date: (lastPay.verifiedAt ?? lastPay.createdAt).toISOString().slice(0, 10),
            amount: lastPay.amount.toFixed(3),
          }
        : null;

      // Collections rollup: the most severe headline status across the children.
      const profiles = await tx.studentBillingProfile.findMany({
        where: { studentId: { in: studentIds } },
        select: { collectionsStatus: true },
      });
      const collectionStatus = profiles.some((p) => p.collectionsStatus === 'LEGAL')
        ? 'LEGAL'
        : profiles.some((p) => p.collectionsStatus === 'FINANCIAL_ISSUE')
          ? 'FINANCIAL_ISSUE'
          : 'NONE';

      return {
        charged: charged.toFixed(3),
        discounts: discounts.toFixed(3),
        netCharged: charged.minus(discounts).toFixed(3),
        paid: (paidAgg._sum.amount ?? ZERO).toFixed(3),
        outstanding: outstanding.toFixed(3),
        creditBalance: creditBalance.toFixed(3),
        refunded: (refundAgg._sum.amount ?? ZERO).toFixed(3),
        nextDue,
        lastPayment,
        collectionStatus,
        childrenCount: studentIds.length,
      };
    });
  }

  /** Available account credit = credit lots owned by the account (Payer), or held by its students. */
  private async financialAccountCreditBalanceTx(
    tx: TxClient,
    payerId: string,
    studentIds: string[],
  ): Promise<Prisma.Decimal> {
    const credits = await tx.credit.findMany({
      where: {
        OR: [{ payerId }, { account: { studentId: { in: studentIds } } }],
      },
      select: { id: true, amount: true },
    });
    const consumedBy = await this.consumedByCredit(
      tx,
      credits.map((c) => c.id),
    );
    return credits.reduce(
      (total, c) => total.plus(floorZero(c.amount.minus(consumedBy.get(c.id) ?? ZERO))),
      ZERO,
    );
  }

  /** The student ids billed through a financial account / Payer (allocation scope). */
  studentIdsForFinancialAccount(payerId: string): Promise<string[]> {
    return this.run(async (tx) => {
      const rows = await tx.studentFinancialAccount.findMany({
        where: { payerId },
        select: { studentId: true },
      });
      return rows.map((r) => r.studentId);
    });
  }

  /**
   * The Financial Account's Billing Schedule (LR — dynamic read model, ADR: no persisted account
   * plan). Merges every student's installments across the account into ONE schedule keyed by due
   * date; each row expands into per-student / per-fee lines. Computed on view from the ledger (the
   * single source of truth) — no cache, no account-installment table. Bounded to one account.
   */
  billingSchedule(payerId: string): Promise<BillingSchedule> {
    return this.run(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          installmentId: string;
          dueDate: Date | null;
          amount: string;
          paid: string;
          status: string;
          studentId: string;
          studentName: string;
          chargeDescription: string;
        }>
      >(Prisma.sql`
        SELECT i.id AS "installmentId", i."dueDate" AS "dueDate",
          i.amount::text AS amount, i.status::text AS status,
          COALESCE(SUM(pa.amount) FILTER (WHERE pa."reversedAt" IS NULL), 0)::text AS paid,
          ch."studentId" AS "studentId",
          COALESCE(TRIM(st."firstNameEn" || ' ' || st."lastNameEn"), 'Unknown') AS "studentName",
          ch.description AS "chargeDescription"
        FROM "Installment" i
        JOIN "Charge" ch ON ch.id = i."chargeId"
        JOIN "StudentFinancialAccount" sfa ON sfa.id = ch."accountId"
        JOIN "Student" st ON st.id = ch."studentId"
        LEFT JOIN "PaymentAllocation" pa ON pa."installmentId" = i.id
        WHERE sfa."payerId" = ${payerId}::uuid
          AND ch.status NOT IN ('CANCELLED', 'WRITTEN_OFF')
          AND i.status <> 'CANCELLED'
          AND st."deletedAt" IS NULL
        GROUP BY i.id, i."dueDate", i.amount, i.status, ch."studentId",
          st."firstNameEn", st."lastNameEn", ch.description
        ORDER BY i."dueDate" ASC NULLS LAST
      `);

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const lineStatus = (
        instStatus: string,
        balance: Prisma.Decimal,
        paid: Prisma.Decimal,
        due: Date | null,
      ): 'PAID' | 'PARTIAL' | 'OVERDUE' | 'UPCOMING' => {
        if (instStatus === 'PAID' || instStatus === 'WAIVED' || balance.lessThanOrEqualTo(ZERO))
          return 'PAID';
        if (due && due < startOfToday) return 'OVERDUE';
        if (paid.greaterThan(ZERO)) return 'PARTIAL';
        return 'UPCOMING';
      };

      // Group by due date (null dates share one "undated" bucket at the end).
      const buckets = new Map<string, BillingScheduleRow>();
      const totals = { amount: ZERO, paid: ZERO, balance: ZERO };
      for (const r of rows) {
        const amount = new Prisma.Decimal(r.amount);
        const paid = new Prisma.Decimal(r.paid);
        const balance = floorZero(amount.minus(paid));
        const due = r.dueDate;
        const key = due ? due.toISOString().slice(0, 10) : 'undated';
        let row = buckets.get(key);
        if (!row) {
          row = {
            dueDate: due ? due.toISOString() : null,
            amount: ZERO.toString(),
            paid: ZERO.toString(),
            balance: ZERO.toString(),
            status: 'UPCOMING',
            lines: [],
          };
          buckets.set(key, row);
        }
        row.lines.push({
          installmentId: r.installmentId,
          studentId: r.studentId,
          studentName: r.studentName,
          chargeDescription: r.chargeDescription,
          amount: amount.toString(),
          paid: paid.toString(),
          balance: balance.toString(),
          status: lineStatus(r.status, balance, paid, due),
        });
        totals.amount = totals.amount.plus(amount);
        totals.paid = totals.paid.plus(paid);
        totals.balance = totals.balance.plus(balance);
      }

      // Roll each row's totals + headline status up from its lines.
      const rowsOut = [...buckets.values()].map((row) => {
        let amt = ZERO;
        let pd = ZERO;
        let bal = ZERO;
        let anyOverdue = false;
        let anyPaid = false;
        let allPaid = true;
        for (const l of row.lines) {
          amt = amt.plus(l.amount);
          pd = pd.plus(l.paid);
          bal = bal.plus(l.balance);
          if (l.status === 'OVERDUE') anyOverdue = true;
          if (l.status === 'PARTIAL' || (l.status === 'PAID' && Number(l.paid) > 0)) anyPaid = true;
          if (l.status !== 'PAID') allPaid = false;
        }
        row.amount = amt.toString();
        row.paid = pd.toString();
        row.balance = bal.toString();
        row.status = allPaid ? 'PAID' : anyOverdue ? 'OVERDUE' : anyPaid ? 'PARTIAL' : 'UPCOMING';
        return row;
      });

      return {
        rows: rowsOut,
        totals: {
          amount: totals.amount.toString(),
          paid: totals.paid.toString(),
          balance: totals.balance.toString(),
        },
      };
    });
  }

  /** Account summary (LR-4..6). */
  accountSummary(studentId: string): Promise<AccountSummary> {
    return this.run(async (tx) => this.accountSummaryTx(tx, studentId));
  }

  private async accountSummaryTx(tx: TxClient, studentId: string): Promise<AccountSummary> {
    const [chargeAgg, discountAgg, refundAgg] = await Promise.all([
      tx.charge.aggregate({
        where: { studentId, status: { notIn: ['CANCELLED', 'WRITTEN_OFF'] } },
        _sum: { amount: true },
      }),
      tx.feeAdjustment.aggregate({
        where: { studentId, status: 'APPLIED', chargeId: { not: null } },
        _sum: { amount: true },
      }),
      tx.refund.aggregate({ where: { studentId, status: 'VERIFIED' }, _sum: { amount: true } }),
    ]);
    const charged = chargeAgg._sum.amount ?? ZERO;
    const discounts = discountAgg._sum.amount ?? ZERO;
    const netCharged = charged.minus(discounts);

    // paid + outstanding come from installment balances (LR-3/LR-4).
    const open = await this.openInstallmentsTx(tx, studentId);
    const outstanding = open.reduce((s, i) => s.plus(i.balance), ZERO);
    const paidAgg = await tx.paymentAllocation.aggregate({
      where: { reversedAt: null, installment: { charge: { studentId } } },
      _sum: { amount: true },
    });
    const paid = paidAgg._sum.amount ?? ZERO;
    const creditBalance = await this.creditBalanceTx(tx, studentId);
    const refunded = refundAgg._sum.amount ?? ZERO;

    return {
      charged: charged.toFixed(3),
      discounts: discounts.toFixed(3),
      netCharged: netCharged.toFixed(3),
      paid: paid.toFixed(3),
      outstanding: outstanding.toFixed(3),
      creditBalance: creditBalance.toFixed(3),
      refunded: refunded.toFixed(3),
    };
  }

  private async openInstallmentsTx(
    tx: TxClient,
    studentId: string,
  ): Promise<Array<{ balance: Prisma.Decimal }>> {
    const installments = await tx.installment.findMany({
      where: {
        charge: { studentId, status: { notIn: ['CANCELLED', 'WRITTEN_OFF'] } },
        status: { notIn: ['CANCELLED', 'WAIVED'] },
      },
      select: { id: true, amount: true },
    });
    const paidBy = await this.paidByInstallment(
      tx,
      installments.map((i) => i.id),
    );
    return installments.map((inst) => ({
      balance: floorZero(inst.amount.minus(paidBy.get(inst.id) ?? ZERO)),
    }));
  }

  // ─────────────────────────────────────────────────────────── credit ledger

  private async creditBalanceTx(tx: TxClient, studentId: string): Promise<Prisma.Decimal> {
    const credits = await tx.credit.findMany({
      where: { account: { studentId } },
      select: { id: true, amount: true },
    });
    const consumedBy = await this.consumedByCredit(
      tx,
      credits.map((c) => c.id),
    );
    return credits.reduce(
      (total, c) => total.plus(floorZero(c.amount.minus(consumedBy.get(c.id) ?? ZERO))),
      ZERO,
    );
  }

  availableCredit(studentId: string): Promise<Prisma.Decimal> {
    return this.run((tx) => this.creditBalanceTx(tx, studentId));
  }

  /** Credit lots with their remaining balance (CR-1). */
  listCredits(studentId: string): Promise<Array<Credit & { remaining: string }>> {
    return this.run(async (tx) => {
      const credits = await tx.credit.findMany({
        where: { account: { studentId } },
        orderBy: { createdAt: 'asc' },
      });
      const consumedBy = await this.consumedByCredit(
        tx,
        credits.map((c) => c.id),
      );
      return credits.map((c) => ({
        ...c,
        remaining: floorZero(c.amount.minus(consumedBy.get(c.id) ?? ZERO)).toFixed(3),
      }));
    });
  }

  // ─────────────────────────────────────────────────────────── adjustments

  applyAdjustment(data: {
    accountId: string;
    studentId: string;
    chargeId: string | null;
    type: FeeAdjustment['type'];
    amount: Prisma.Decimal;
    percent: Prisma.Decimal | null;
    reason: string;
  }): Promise<FeeAdjustment> {
    return this.run(async (tx, tenantId) => {
      const adj = await tx.feeAdjustment.create({
        data: {
          tenantId,
          accountId: data.accountId,
          studentId: data.studentId,
          chargeId: data.chargeId,
          type: data.type,
          amount: data.amount,
          percent: data.percent,
          reason: data.reason,
          createdById: this.actor(),
        },
      });
      if (data.chargeId) {
        await this.rebalanceInstallments(tx, data.chargeId, -toFils(data.amount));
        await this.recomputeCharge(tx, data.chargeId);
      } else if (data.type === 'CREDIT_MEMO') {
        // Account-level credit memo grants a Credit lot (CR-4).
        await tx.credit.create({
          data: {
            tenantId,
            accountId: data.accountId,
            source: 'CREDIT_MEMO',
            amount: data.amount,
            adjustmentId: adj.id,
            reason: data.reason,
            createdById: this.actor(),
          },
        });
      }
      await this.writeAudit(tx, tenantId, {
        action: 'finance.adjustment.apply',
        entityType: 'FeeAdjustment',
        entityId: adj.id,
        metadata: {
          studentId: data.studentId,
          chargeId: data.chargeId,
          type: data.type,
          amount: data.amount.toString(),
        },
      });
      return adj;
    });
  }

  reverseAdjustment(id: string): Promise<FeeAdjustment> {
    return this.run(async (tx, tenantId) => {
      const existing = await tx.feeAdjustment.findFirst({ where: { id } });
      const adj = await tx.feeAdjustment.update({
        where: { id },
        data: { status: 'REVERSED', reversedAt: new Date(), reversedById: this.actor() },
      });
      if (adj.chargeId) {
        await this.rebalanceInstallments(tx, adj.chargeId, toFils(adj.amount));
        await this.recomputeCharge(tx, adj.chargeId);
      } else if (existing?.type === 'CREDIT_MEMO') {
        // Remove the granted credit lot (only if not yet consumed).
        const credit = await tx.credit.findUnique({ where: { adjustmentId: id } });
        if (credit) {
          const consumed = await tx.refundConsumption.aggregate({
            where: { creditId: credit.id },
            _sum: { amount: true },
          });
          if ((consumed._sum.amount ?? ZERO).equals(ZERO)) {
            await tx.credit.delete({ where: { id: credit.id } });
          }
        }
      }
      await this.writeAudit(tx, tenantId, {
        action: 'finance.adjustment.reverse',
        entityType: 'FeeAdjustment',
        entityId: adj.id,
      });
      return adj;
    });
  }

  findAdjustment(id: string): Promise<FeeAdjustment | null> {
    return this.run((tx) => tx.feeAdjustment.findFirst({ where: { id } }));
  }

  listAdjustments(studentId: string): Promise<FeeAdjustment[]> {
    return this.run((tx) =>
      tx.feeAdjustment.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' } }),
    );
  }

  // ─────────────────────────────────────────────────────────── allocations

  /** Apply (part of) a verified payment to an installment; recompute installment + charge. */
  allocate(data: {
    paymentId: string;
    installmentId: string;
    amount: Prisma.Decimal;
  }): Promise<PaymentAllocation> {
    return this.run(async (tx, tenantId) => {
      const alloc = await tx.paymentAllocation.create({
        data: {
          tenantId,
          paymentId: data.paymentId,
          installmentId: data.installmentId,
          amount: data.amount,
          createdById: this.actor(),
        },
      });
      const inst = await tx.installment.findFirst({ where: { id: data.installmentId } });
      await this.recomputeInstallment(tx, data.installmentId);
      if (inst) await this.recomputeCharge(tx, inst.chargeId);
      await this.writeAudit(tx, tenantId, {
        action: 'finance.allocation.create',
        entityType: 'PaymentAllocation',
        entityId: alloc.id,
        metadata: {
          paymentId: data.paymentId,
          installmentId: data.installmentId,
          amount: data.amount.toString(),
        },
      });
      return alloc;
    });
  }

  unallocatedFor(paymentId: string): Promise<Prisma.Decimal> {
    return this.run(async (tx) => {
      const payment = await tx.payment.findFirst({ where: { id: paymentId } });
      if (!payment) return ZERO;
      const agg = await tx.paymentAllocation.aggregate({
        where: { paymentId, reversedAt: null },
        _sum: { amount: true },
      });
      return payment.amount.minus(agg._sum.amount ?? ZERO);
    });
  }

  /** Grant an over-payment credit for a verified payment's unallocated residue (AR-5, CR-4). The
   * credit is owned by the Financial Account via `payerId` (for an account over-payment the balance
   * belongs to the payer across all its students); `accountId` records a student AR home. */
  grantOverpaymentCredit(data: {
    accountId: string;
    payerId: string | null;
    paymentId: string;
    amount: Prisma.Decimal;
  }): Promise<Credit> {
    return this.run(async (tx, tenantId) => {
      const credit = await tx.credit.create({
        data: {
          tenantId,
          accountId: data.accountId,
          payerId: data.payerId,
          source: 'OVERPAYMENT',
          amount: data.amount,
          paymentId: data.paymentId,
          createdById: this.actor(),
        },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'finance.credit.grant',
        entityType: 'Credit',
        entityId: credit.id,
        metadata: { source: 'OVERPAYMENT', amount: data.amount.toString() },
      });
      return credit;
    });
  }

  // ─────────────────────────────────────────────────────────── refunds

  createRefund(data: {
    accountId: string;
    studentId: string;
    payerId: string | null;
    amount: Prisma.Decimal;
    method: Refund['method'];
    reference: string | null;
    reason: string;
  }): Promise<Refund> {
    return this.run(async (tx, tenantId) => {
      const refund = await tx.refund.create({
        data: { tenantId, ...data, recordedById: this.actor() },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'finance.refund.create',
        entityType: 'Refund',
        entityId: refund.id,
        metadata: { studentId: data.studentId, amount: data.amount.toString() },
      });
      return refund;
    });
  }

  /** Verify a refund: consume credit lots FIFO (oldest first) via RefundConsumption (BR-34). */
  verifyRefund(id: string): Promise<Refund> {
    return this.run(async (tx, tenantId) => {
      const refund = await tx.refund.findFirstOrThrow({ where: { id } });
      const credits = await tx.credit.findMany({
        where: { account: { studentId: refund.studentId } },
        orderBy: { createdAt: 'asc' },
      });
      let remaining = toFils(refund.amount);
      for (const c of credits) {
        if (remaining <= 0) break;
        const consumedAgg = await tx.refundConsumption.aggregate({
          where: { creditId: c.id },
          _sum: { amount: true },
        });
        const availFils = toFils(c.amount) - toFils(consumedAgg._sum.amount ?? ZERO);
        if (availFils <= 0) continue;
        const take = Math.min(remaining, availFils);
        await tx.refundConsumption.create({
          data: { tenantId, refundId: id, creditId: c.id, amount: fromFils(take) },
        });
        remaining -= take;
      }
      const updated = await tx.refund.update({
        where: { id },
        data: { status: 'VERIFIED', verifiedById: this.actor(), verifiedAt: new Date() },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'finance.refund.verify',
        entityType: 'Refund',
        entityId: id,
        metadata: { amount: updated.amount.toString() },
      });
      return updated;
    });
  }

  setRefundRejected(id: string, note?: string): Promise<Refund> {
    return this.run(async (tx, tenantId) => {
      const refund = await tx.refund.update({
        where: { id },
        data: {
          status: 'REJECTED',
          verifiedById: this.actor(),
          verifiedAt: new Date(),
          ...(note !== undefined ? { note } : {}),
        },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'finance.refund.reject',
        entityType: 'Refund',
        entityId: id,
        metadata: { amount: refund.amount.toString() },
      });
      return refund;
    });
  }

  findRefund(id: string): Promise<Refund | null> {
    return this.run((tx) => tx.refund.findFirst({ where: { id } }));
  }

  listRefunds(studentId: string): Promise<Refund[]> {
    return this.run((tx) =>
      tx.refund.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' } }),
    );
  }

  // ─────────────────────────────────────────────────────────── lookups

  chargeById(
    id: string,
  ): Promise<(Charge & { plans: PaymentPlan[]; installments: Installment[] }) | null> {
    return this.run((tx) =>
      tx.charge.findFirst({
        where: { id },
        include: {
          plans: { where: { status: 'ACTIVE' } },
          installments: { orderBy: { seq: 'asc' } },
        },
      }),
    );
  }

  paymentById(id: string) {
    return this.run((tx) => tx.payment.findFirst({ where: { id } }));
  }

  installmentById(id: string): Promise<Installment | null> {
    return this.run((tx) => tx.installment.findFirst({ where: { id } }));
  }

  /** Open installments of a charge (positive balance), earliest due first — for FIFO allocation. */
  openInstallmentsForCharge(
    chargeId: string,
  ): Promise<Array<{ id: string; dueDate: Date | null; seq: number; balance: Prisma.Decimal }>> {
    return this.run(async (tx) => this.openInstallmentsForChargeTx(tx, chargeId));
  }

  private async openInstallmentsForChargeTx(
    tx: TxClient,
    chargeId: string,
  ): Promise<Array<{ id: string; dueDate: Date | null; seq: number; balance: Prisma.Decimal }>> {
    const installments = await tx.installment.findMany({
      where: { chargeId, status: { notIn: ['CANCELLED', 'WAIVED'] } },
      orderBy: [{ dueDate: 'asc' }, { seq: 'asc' }],
    });
    const paidBy = await this.paidByInstallment(
      tx,
      installments.map((i) => i.id),
    );
    const out: Array<{ id: string; dueDate: Date | null; seq: number; balance: Prisma.Decimal }> =
      [];
    for (const inst of installments) {
      const balance = floorZero(inst.amount.minus(paidBy.get(inst.id) ?? ZERO));
      if (balance.greaterThan(ZERO))
        out.push({ id: inst.id, dueDate: inst.dueDate, seq: inst.seq, balance });
    }
    return out;
  }

  studentExists(studentId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.student.findFirst({ where: { id: studentId, deletedAt: null } })) !== null,
    );
  }
}
