import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, type Charge, type Installment, type PaymentPlan } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantConnectionManager } from '../../prisma/tenant-connection.service';
import { TenantContextStore } from '../../prisma/tenant-context';
import { AccountRepository } from '../account/account.repository';
import { ZERO, fromFils, toFils } from '../shared/money';
import type { ScheduleLine } from './installment-schedule.service';

/** Dimensions carried onto a charge for reporting (RR-2). */
export interface ChargeDimensions {
  academicYearId?: string | null;
  gradeId?: string | null;
  campusId?: string | null;
  feeItemId?: string | null;
  enrollmentId?: string | null;
}

@Injectable()
export class ChargeRepository extends TenantRepository {
  constructor(
    prisma: PrismaService,
    connections: TenantConnectionManager,
    private readonly accounts: AccountRepository,
  ) {
    super(prisma, connections);
  }

  private actor(): string | null {
    return TenantContextStore.get()?.actorUserId ?? null;
  }

  /**
   * Create a charge (the obligation) with its account, plus one **implicit installment**
   * (seq 1, amount = net = amount, due = dueDate) so all money always allocates to an
   * installment — one uniform path (BR-8).
   */
  create(data: {
    studentId: string;
    description: string;
    amount: number;
    dueDate: Date | null;
    dimensions?: ChargeDimensions;
  }): Promise<Charge> {
    return this.run(async (tx, tenantId) => {
      const account = await this.accounts.ensureAccountTx(tx, tenantId, data.studentId);
      const charge = await tx.charge.create({
        data: {
          tenantId,
          accountId: account.id,
          studentId: data.studentId,
          description: data.description,
          amount: new Prisma.Decimal(data.amount),
          dueDate: data.dueDate,
          academicYearId: data.dimensions?.academicYearId ?? null,
          gradeId: data.dimensions?.gradeId ?? null,
          campusId: data.dimensions?.campusId ?? null,
          feeItemId: data.dimensions?.feeItemId ?? null,
          enrollmentId: data.dimensions?.enrollmentId ?? null,
          createdById: this.actor(),
        },
      });
      await tx.installment.create({
        data: {
          tenantId,
          chargeId: charge.id,
          planId: null,
          seq: 1,
          dueDate: data.dueDate,
          amount: charge.amount,
        },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'finance.charge.create',
        entityType: 'Charge',
        entityId: charge.id,
        metadata: { studentId: charge.studentId, amount: charge.amount.toString() },
      });
      return charge;
    });
  }

  /**
   * Create (or replace) a payment plan for a charge: supersede any active plan, cancel unsettled
   * installments (paid ones are retained), and materialise the new schedule. Σ lines == charge.net
   * is guaranteed by the caller (InstallmentScheduleService) (BR-9, BR-11, IR-6).
   */
  createPlan(data: {
    chargeId: string;
    cadence: PaymentPlan['cadence'];
    installments: number;
    firstDueDate: Date;
    balloonFinal: boolean;
    lines: ScheduleLine[];
    reason?: string | null;
  }): Promise<PaymentPlan> {
    return this.run(async (tx, tenantId) => {
      const supersededResult = await tx.paymentPlan.updateMany({
        where: { chargeId: data.chargeId, status: 'ACTIVE' },
        data: { status: 'SUPERSEDED' },
      });
      const installments = await tx.installment.findMany({
        where: { chargeId: data.chargeId, status: { not: 'CANCELLED' } },
      });
      for (const inst of installments) {
        const alloc = await tx.paymentAllocation.aggregate({
          where: { installmentId: inst.id, reversedAt: null },
          _sum: { amount: true },
        });
        const paid = alloc._sum.amount ?? new Prisma.Decimal(0);
        if (paid.equals(0)) {
          // Fully unpaid → cancel; its whole balance is rescheduled into the new plan.
          await tx.installment.update({
            where: { id: inst.id },
            data: { status: 'CANCELLED', amount: 0 },
          });
        } else if (paid.lessThan(inst.amount)) {
          // Partially paid → shrink the superseded installment to EXACTLY what was paid, so it
          // carries no residual balance. The unpaid remainder is already inside the ledger
          // outstanding the new plan is built from; leaving the residual here would break the
          // invariant Σ(installment.amount) == charge.net and double-count it in the
          // installment-sum outstanding path (account / statement / collections) against the
          // charge's net−paid path — diverging the two by the residual (BR-9, BR-11).
          await tx.installment.update({
            where: { id: inst.id },
            data: { amount: paid, status: 'PAID' },
          });
        }
        // Fully paid (paid == amount) → retained as-is; balance already zero.
      }
      const plan = await tx.paymentPlan.create({
        data: {
          tenantId,
          chargeId: data.chargeId,
          cadence: data.cadence,
          installments: data.installments,
          firstDueDate: data.firstDueDate,
          balloonFinal: data.balloonFinal,
          createdById: this.actor(),
        },
      });
      for (const line of data.lines) {
        await tx.installment.create({
          data: {
            tenantId,
            chargeId: data.chargeId,
            planId: plan.id,
            seq: line.seq,
            dueDate: line.dueDate,
            amount: fromFils(line.amountFils),
          },
        });
      }
      // ── Fail-closed reconciliation (BR-11, IR-2): after the write, the two outstanding paths
      // MUST be identical to the fils, or the whole renegotiation is rolled back:
      //   charge outstanding      = max(net − Σpaid, 0)                     [charge view]
      //   installment outstanding = Σ max(inst.amount − inst.paid, 0)       [account/statement]
      // and the domain invariant  Σ(non-cancelled inst.amount) == net       must hold.
      const chargeRow = await tx.charge.findFirstOrThrow({ where: { id: data.chargeId } });
      const discountAgg = await tx.feeAdjustment.aggregate({
        where: { chargeId: data.chargeId, status: 'APPLIED' },
        _sum: { amount: true },
      });
      const netFils = toFils(chargeRow.amount) - toFils(discountAgg._sum.amount ?? ZERO);
      const liveInstallments = await tx.installment.findMany({
        where: { chargeId: data.chargeId, status: { not: 'CANCELLED' } },
      });
      let paidFils = 0;
      let scheduledFils = 0;
      let instOutstandingFils = 0;
      for (const inst of liveInstallments) {
        const a = await tx.paymentAllocation.aggregate({
          where: { installmentId: inst.id, reversedAt: null },
          _sum: { amount: true },
        });
        const instPaid = toFils(a._sum.amount ?? ZERO);
        const instAmount = toFils(inst.amount);
        paidFils += instPaid;
        scheduledFils += instAmount;
        instOutstandingFils += Math.max(instAmount - instPaid, 0);
      }
      const chargeOutstandingFils = Math.max(netFils - paidFils, 0);
      if (scheduledFils !== netFils || instOutstandingFils !== chargeOutstandingFils) {
        throw new BadRequestException(
          `Renegotiation reconciliation failed: charge outstanding ` +
            `${fromFils(chargeOutstandingFils).toFixed(3)} vs Σ installment outstanding ` +
            `${fromFils(instOutstandingFils).toFixed(3)} JOD ` +
            `(Σ installments ${fromFils(scheduledFils).toFixed(3)} vs net ` +
            `${fromFils(netFils).toFixed(3)}) — operation aborted.`,
        );
      }

      const replaced = supersededResult.count > 0;
      await this.writeAudit(tx, tenantId, {
        action: replaced ? 'finance.plan.renegotiate' : 'finance.plan.create',
        entityType: 'PaymentPlan',
        entityId: plan.id,
        metadata: {
          chargeId: data.chargeId,
          cadence: data.cadence,
          installments: data.installments,
          replaced,
          supersededCount: supersededResult.count,
          reason: data.reason ?? null,
        },
      });
      return plan;
    });
  }

  cancelCharge(id: string): Promise<Charge> {
    return this.run(async (tx, tenantId) => {
      const charge = await tx.charge.update({ where: { id }, data: { status: 'CANCELLED' } });
      await tx.installment.updateMany({
        where: { chargeId: id, status: { notIn: ['PAID', 'PARTIAL'] } },
        data: { status: 'CANCELLED' },
      });
      await tx.paymentPlan.updateMany({
        where: { chargeId: id, status: 'ACTIVE' },
        data: { status: 'CANCELLED' },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'finance.charge.cancel',
        entityType: 'Charge',
        entityId: id,
      });
      return charge;
    });
  }

  /**
   * Reverse a cancellation (used by reactivation): re-open a CANCELLED charge, its cancelled
   * (never paid) installments and its plan. Paid/partial installments were never cancelled, so they
   * are untouched. The mirror image of cancelCharge; no amounts change.
   */
  reopenCharge(id: string): Promise<Charge> {
    return this.run(async (tx, tenantId) => {
      const charge = await tx.charge.update({ where: { id }, data: { status: 'PENDING' } });
      await tx.installment.updateMany({
        where: { chargeId: id, status: 'CANCELLED' },
        data: { status: 'SCHEDULED' },
      });
      await tx.paymentPlan.updateMany({
        where: { chargeId: id, status: 'CANCELLED' },
        data: { status: 'ACTIVE' },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'finance.charge.reopen',
        entityType: 'Charge',
        entityId: id,
      });
      return charge;
    });
  }

  /** Reschedule a single installment's due date/amount, re-asserting Σ == net (BR-15, IR-4). */
  rescheduleInstallment(
    id: string,
    dueDate: Date | null,
    amount: number | null,
  ): Promise<Installment> {
    return this.run(async (tx, tenantId) => {
      const inst = await tx.installment.findFirstOrThrow({ where: { id } });
      const data: Prisma.InstallmentUpdateInput = {};
      if (dueDate !== null) data.dueDate = dueDate;
      if (amount !== null) data.amount = new Prisma.Decimal(amount);
      const updated = await tx.installment.update({ where: { id }, data });
      const [sumAgg, charge, discountAgg] = await Promise.all([
        tx.installment.aggregate({
          where: { chargeId: inst.chargeId, status: { not: 'CANCELLED' } },
          _sum: { amount: true },
        }),
        tx.charge.findFirstOrThrow({ where: { id: inst.chargeId } }),
        tx.feeAdjustment.aggregate({
          where: { chargeId: inst.chargeId, status: 'APPLIED' },
          _sum: { amount: true },
        }),
      ]);
      const net = charge.amount.minus(discountAgg._sum.amount ?? new Prisma.Decimal(0));
      if (!(sumAgg._sum.amount ?? new Prisma.Decimal(0)).equals(net)) {
        throw new Error('Reschedule would break Σ installments == charge net (BR-9)');
      }
      await this.writeAudit(tx, tenantId, {
        action: 'finance.installment.reschedule',
        entityType: 'Installment',
        entityId: id,
        metadata: { chargeId: inst.chargeId },
      });
      return updated;
    });
  }

  findByStudent(studentId: string): Promise<Charge[]> {
    return this.run((tx) =>
      tx.charge.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' } }),
    );
  }

  chargeById(id: string): Promise<Charge | null> {
    return this.run((tx) => tx.charge.findFirst({ where: { id } }));
  }

  studentExists(studentId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.student.findFirst({ where: { id: studentId, deletedAt: null } })) !== null,
    );
  }
}
