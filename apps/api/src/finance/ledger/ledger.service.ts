import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type Credit,
  type FeeAdjustment,
  type PaymentAllocation,
  type Payment,
  type Refund,
} from '@prisma/client';
import { LedgerRepository } from './ledger.repository';
import { AccountRepository } from '../account/account.repository';
import { FifoByDueDatePolicy } from './allocation-policy';
import { FinanceBridgeService } from '../../einvoicing/finance-bridge.service';
import { ZERO } from '../shared/money';
import type { AllocatePaymentDto, ApplyAdjustmentDto, CreateRefundDto } from './ledger.dto';

/**
 * AR ledger orchestration: structured deductions (discount/scholarship/waiver/write-off/
 * credit-memo/correction), payment→installment allocation (via the AllocationPolicy port),
 * over-payment credit, and refunds that consume credit lots. All figures come from the ledger
 * repository (the single source of truth); this service only validates + orchestrates (LR/AR/CR).
 */
@Injectable()
export class LedgerService {
  constructor(
    private readonly repo: LedgerRepository,
    private readonly accounts: AccountRepository,
    private readonly fifo: FifoByDueDatePolicy,
    private readonly bridge: FinanceBridgeService,
  ) {}

  // ───────────────────────────────────────────────────────── adjustments

  async applyAdjustment(dto: ApplyAdjustmentDto): Promise<FeeAdjustment> {
    const account = await this.accounts.findByStudent(dto.studentId);
    if (!account) throw new BadRequestException('Student has no financial account');
    if (dto.amount === undefined && dto.percent === undefined) {
      throw new BadRequestException('Provide either an amount or a percent');
    }
    if (dto.percent !== undefined && !dto.chargeId) {
      throw new BadRequestException('A percent deduction requires a chargeId to compute against');
    }

    let amount: Prisma.Decimal;
    const chargeId = dto.chargeId ?? null;

    if (dto.chargeId) {
      const views = await this.repo.chargeViews(dto.studentId);
      const view = views.find((v) => v.charge.id === dto.chargeId);
      if (!view) throw new BadRequestException('Charge not found for this student');
      if (view.charge.status === 'CANCELLED') {
        throw new ConflictException('Cannot adjust a cancelled charge');
      }
      const balance = new Prisma.Decimal(view.balance);
      amount =
        dto.percent !== undefined
          ? new Prisma.Decimal(view.net).times(dto.percent).dividedBy(100)
          : new Prisma.Decimal(dto.amount!);
      if (amount.greaterThan(balance)) {
        throw new BadRequestException(
          `Deduction ${amount.toFixed(3)} exceeds the charge's remaining balance ${balance.toFixed(3)}`,
        );
      }
    } else {
      if (dto.type !== 'CREDIT_MEMO') {
        throw new BadRequestException('Only a CREDIT_MEMO may be account-level (no chargeId)');
      }
      amount = new Prisma.Decimal(dto.amount!);
    }

    const adjustment = await this.repo.applyAdjustment({
      accountId: account.id,
      studentId: dto.studentId,
      chargeId,
      type: dto.type,
      amount,
      percent: dto.percent !== undefined ? new Prisma.Decimal(dto.percent) : null,
      reason: dto.reason,
    });
    // Best-effort: if this reduced an already-invoiced charge, auto-issue a 381 credit note.
    if (chargeId) {
      await this.bridge.tryCreditForCharge(chargeId, Number(amount), dto.reason);
    }
    return adjustment;
  }

  async reverseAdjustment(id: string): Promise<FeeAdjustment> {
    const adj = await this.repo.findAdjustment(id);
    if (!adj) throw new NotFoundException('Adjustment not found');
    if (adj.status === 'REVERSED') throw new ConflictException('Adjustment is already reversed');
    return this.repo.reverseAdjustment(id);
  }

  // ───────────────────────────────────────────────────────── allocations

  /** Manual allocation: apply a verified payment to specific installments (AR-6). */
  async allocate(dto: AllocatePaymentDto): Promise<PaymentAllocation[]> {
    const payment = await this.repo.paymentById(dto.paymentId);
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'VERIFIED') {
      throw new ConflictException('Only a verified payment can be allocated');
    }
    const requested = dto.allocations.reduce((s, a) => s.plus(a.amount), ZERO);
    const unallocated = await this.repo.unallocatedFor(dto.paymentId);
    if (requested.greaterThan(unallocated)) {
      throw new BadRequestException(
        `Allocation ${requested.toFixed(3)} exceeds the unallocated payment ${unallocated.toFixed(3)}`,
      );
    }
    const results: PaymentAllocation[] = [];
    for (const line of dto.allocations) {
      const inst = await this.repo.installmentById(line.installmentId);
      if (!inst) throw new BadRequestException(`Installment ${line.installmentId} not found`);
      results.push(
        await this.repo.allocate({
          paymentId: dto.paymentId,
          installmentId: line.installmentId,
          amount: new Prisma.Decimal(line.amount),
        }),
      );
    }
    return results;
  }

  /**
   * On verify, auto-allocate a payment across the open installments (FIFO by due date), then bank
   * any residue as an over-payment Credit (AR-2, AR-5, BR-23, BR-24).
   *
   * When the payment is account-scoped (`accountScoped` — the unified Financial-Account flow), the
   * scope is the union of ALL the account's (payer's) students' open installments (cross-student FIFO
   * — the CROSS_STUDENT seam) and the residue banks to the account credit (owned via payerId). A
   * legacy student payment (accountScoped=false) allocates within its own student only — unchanged
   * behaviour. The allocation policy is identical either way; only the candidate installments differ.
   */
  async allocateOnVerify(payment: Payment): Promise<void> {
    let remaining = await this.repo.unallocatedFor(payment.id);
    if (remaining.lessThanOrEqualTo(ZERO)) return;

    const open =
      payment.accountScoped && payment.payerId
        ? await this.repo.openInstallmentsForStudents(
            await this.repo.studentIdsForFinancialAccount(payment.payerId),
          )
        : await this.repo.openInstallments(payment.studentId);
    const lines = this.fifo.allocate(
      remaining,
      open.map((o, i) => ({ id: o.id, dueDate: o.dueDate, seq: i, balance: o.balance })),
    );
    for (const line of lines) {
      await this.repo.allocate({
        paymentId: payment.id,
        installmentId: line.installmentId,
        amount: line.amount,
      });
      remaining = remaining.minus(line.amount);
    }
    if (remaining.greaterThan(ZERO)) {
      await this.repo.grantOverpaymentCredit({
        accountId: payment.accountId,
        payerId: payment.payerId,
        paymentId: payment.id,
        amount: remaining,
      });
    }
  }

  /**
   * Manual allocation on verify (AR-6, account flow): apply a just-verified account payment to the
   * installments the officer chose, instead of FIFO. Each target must be one of the account's OWN
   * open installments (cross-student), and no line may exceed that installment's balance or the
   * payment total; any residue banks to the account credit — identical banking to the automatic path.
   */
  async allocateManualOnVerify(
    payment: Payment,
    allocations: Array<{ installmentId: string; amount: number }>,
  ): Promise<void> {
    let remaining = await this.repo.unallocatedFor(payment.id);
    const requested = allocations.reduce((s, a) => s.plus(a.amount), ZERO);
    if (requested.greaterThan(remaining)) {
      throw new BadRequestException(
        `Allocation ${requested.toFixed(3)} exceeds the payment amount ${remaining.toFixed(3)}`,
      );
    }
    // The installments the officer may target: this account's open installments (cross-student).
    const open =
      payment.accountScoped && payment.payerId
        ? await this.repo.openInstallmentsForStudents(
            await this.repo.studentIdsForFinancialAccount(payment.payerId),
          )
        : await this.repo.openInstallments(payment.studentId);
    const balById = new Map(open.map((o) => [o.id, o.balance]));
    for (const line of allocations) {
      const amt = new Prisma.Decimal(line.amount);
      if (amt.lessThanOrEqualTo(ZERO)) continue;
      const balance = balById.get(line.installmentId);
      if (balance === undefined) {
        throw new BadRequestException(
          `Installment ${line.installmentId} is not an open installment of this account`,
        );
      }
      if (amt.greaterThan(balance)) {
        throw new BadRequestException(
          `Allocation ${amt.toFixed(3)} exceeds the installment balance ${balance.toFixed(3)}`,
        );
      }
      await this.repo.allocate({
        paymentId: payment.id,
        installmentId: line.installmentId,
        amount: amt,
      });
      remaining = remaining.minus(amt);
    }
    if (remaining.greaterThan(ZERO)) {
      await this.repo.grantOverpaymentCredit({
        accountId: payment.accountId,
        payerId: payment.payerId,
        paymentId: payment.id,
        amount: remaining,
      });
    }
  }

  // ───────────────────────────────────────────────────────── refunds

  async createRefund(dto: CreateRefundDto): Promise<Refund> {
    const account = await this.accounts.findByStudent(dto.studentId);
    if (!account) throw new BadRequestException('Student has no financial account');
    const available = await this.repo.availableCredit(dto.studentId);
    if (new Prisma.Decimal(dto.amount).greaterThan(available)) {
      throw new BadRequestException(
        `Refund ${dto.amount} exceeds the available credit balance ${available.toFixed(3)}`,
      );
    }
    return this.repo.createRefund({
      accountId: account.id,
      studentId: dto.studentId,
      payerId: account.payerId,
      amount: new Prisma.Decimal(dto.amount),
      method: dto.method,
      reference: dto.reference ?? null,
      reason: dto.reason,
    });
  }

  async verifyRefund(id: string): Promise<Refund> {
    const refund = await this.requirePendingRefund(id);
    const available = await this.repo.availableCredit(refund.studentId);
    if (refund.amount.greaterThan(available)) {
      throw new ConflictException(
        `Refund ${refund.amount.toFixed(3)} now exceeds the available credit ${available.toFixed(3)}`,
      );
    }
    return this.repo.verifyRefund(id);
  }

  async rejectRefund(id: string, note?: string): Promise<Refund> {
    await this.requirePendingRefund(id);
    return this.repo.setRefundRejected(id, note);
  }

  listCredits(studentId: string): Promise<Array<Credit & { remaining: string }>> {
    return this.repo.listCredits(studentId);
  }

  private async requirePendingRefund(id: string): Promise<Refund> {
    const refund = await this.repo.findRefund(id);
    if (!refund) throw new NotFoundException('Refund not found');
    if (refund.status !== 'PENDING')
      throw new ConflictException(`Refund is already ${refund.status}`);
    return refund;
  }
}
