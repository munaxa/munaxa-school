import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Charge, PaymentPlan } from '@prisma/client';
import { ChargeRepository } from './charge.repository';
import { InstallmentScheduleService } from './installment-schedule.service';
import { LedgerRepository, type ChargeView } from '../ledger/ledger.repository';
import { FinanceBridgeService } from '../../einvoicing/finance-bridge.service';
import { toFils, fromFils } from '../shared/money';
import type { CreateChargeDto, CreatePlanDto, RescheduleInstallmentDto } from './charge.dto';

/**
 * Charge aggregate service: creates the financial obligation, manages its payment plan
 * (the installment engine), and exposes the per-charge ledger view. A charge is never split;
 * a plan schedules its net into installments (ADR-001, BR-8..14, IR-*).
 */
@Injectable()
export class ChargeService {
  constructor(
    private readonly repo: ChargeRepository,
    private readonly schedule: InstallmentScheduleService,
    private readonly ledger: LedgerRepository,
    private readonly bridge: FinanceBridgeService,
  ) {}

  async create(dto: CreateChargeDto): Promise<Charge> {
    if (!(await this.repo.studentExists(dto.studentId))) {
      throw new BadRequestException('Student not found in this tenant');
    }
    const charge = await this.repo.create({
      studentId: dto.studentId,
      description: dto.description,
      amount: dto.amount,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      dimensions: {
        academicYearId: dto.academicYearId ?? null,
        gradeId: dto.gradeId ?? null,
        campusId: dto.campusId ?? null,
        feeItemId: dto.feeItemId ?? null,
        enrollmentId: dto.enrollmentId ?? null,
      },
    });
    // Invoices originate from the Charge (BR-36) — best-effort, never blocks (BR-39).
    await this.bridge.tryIssueForCharge(charge.id);
    return charge;
  }

  /**
   * Create or **renegotiate** a payment plan for a charge. The schedule is generated ONLY from the
   * current **Ledger Outstanding Balance** (net − paid, from `chargeViews` — the single source of
   * truth), NEVER from the original charge amount, the original plan total, or a historical schedule.
   * On a renegotiate the previous plan is superseded (its paid installments retained for history)
   * and the new plan begins from the remaining balance only. Invariant (BR-11): the new schedule
   * must sum to the outstanding balance to the last fils, or the operation fails.
   */
  async createPlan(chargeId: string, dto: CreatePlanDto): Promise<PaymentPlan> {
    const charge = await this.repo.chargeById(chargeId);
    if (!charge) throw new NotFoundException('Charge not found');
    if (charge.status === 'CANCELLED' || charge.status === 'WRITTEN_OFF') {
      throw new BadRequestException('Cannot plan a cancelled/written-off charge');
    }
    const views = await this.ledger.chargeViews(charge.studentId);
    const view = views.find((v) => v.charge.id === chargeId)!;
    // The ONLY permitted basis: the current ledger outstanding balance for this charge.
    const outstandingFils = toFils(view.balance);
    if (outstandingFils <= 0) {
      throw new BadRequestException('Charge has no outstanding balance to schedule');
    }

    const lines = this.schedule.generate(outstandingFils, {
      cadence: dto.cadence,
      installments: dto.installments,
      firstDueDate: dto.firstDueDate,
      balloonFinal: dto.balloonFinal ?? false,
      customLines: dto.customLines,
      holidays: dto.holidays,
    });

    // Fail-closed invariant: Σ(new installments) MUST equal the ledger outstanding, to the fils.
    // A generated plan that would recreate the original debt (or any other basis) is rejected.
    const scheduledFils = lines.reduce((sum, l) => sum + l.amountFils, 0);
    if (scheduledFils !== outstandingFils) {
      throw new BadRequestException(
        `Renegotiated plan must equal the ledger outstanding balance ` +
          `(${fromFils(outstandingFils).toFixed(3)} JOD) but the generated schedule sums to ` +
          `${fromFils(scheduledFils).toFixed(3)} JOD — operation aborted.`,
      );
    }
    // Plans/installments never invoice (BR-38) — no bridge call here.
    return this.repo.createPlan({
      chargeId,
      cadence: dto.cadence,
      installments: dto.cadence === 'CUSTOM' ? lines.length : dto.installments,
      firstDueDate: new Date(dto.firstDueDate),
      balloonFinal: dto.balloonFinal ?? false,
      lines,
      reason: dto.reason ?? null,
    });
  }

  cancel(chargeId: string): Promise<Charge> {
    return this.repo.cancelCharge(chargeId);
  }

  /** Reverse a cancellation — re-open the charge, its cancelled installments and plan (reactivation). */
  reopen(chargeId: string): Promise<Charge> {
    return this.repo.reopenCharge(chargeId);
  }

  reschedule(installmentId: string, dto: RescheduleInstallmentDto) {
    return this.repo.rescheduleInstallment(
      installmentId,
      dto.dueDate ? new Date(dto.dueDate) : null,
      dto.amount ?? null,
    );
  }

  /** The per-charge ledger view (charge → plan → installments) for a student. */
  listForStudent(studentId: string): Promise<ChargeView[]> {
    return this.ledger.chargeViews(studentId);
  }
}
