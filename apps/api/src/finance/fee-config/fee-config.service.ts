import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AdjustmentType, DiscountType } from '@prisma/client';
import { FeeConfigRepository } from './fee-config.repository';
import { LedgerService } from '../ledger/ledger.service';
import type {
  CreateDiscountRuleDto,
  CreateGradeFeeScheduleDto,
  CreateTransportFareDto,
  UpdateDiscountRuleDto,
  UpdateGradeFeeScheduleDto,
  UpdateTransportFareDto,
  UpsertBillingPolicyDto,
} from './fee-config.dto';

const date = (s?: string) => (s === undefined ? undefined : new Date(s));

/**
 * Configuration-layer service. Thin orchestration over the repository — the enrollment
 * quote/charge flows (later phases) consume this config. No money is moved here.
 */
const DISCOUNT_TO_ADJUSTMENT: Record<DiscountType, AdjustmentType> = {
  FULL_PAYMENT: 'DISCOUNT',
  SIBLING: 'SIBLING_DISCOUNT',
  SCHOLARSHIP: 'SCHOLARSHIP',
  PROMOTIONAL: 'DISCOUNT',
  MANUAL: 'DISCOUNT',
};

@Injectable()
export class FeeConfigService {
  constructor(
    private readonly repo: FeeConfigRepository,
    private readonly ledger: LedgerService,
  ) {}

  /**
   * Apply a configured discount rule to a student's charge — records it as a FeeAdjustment via the
   * existing ledger (the system of record for discounts). FIXED → amount; PERCENT → percent of the
   * charge net (the ledger enforces "cannot exceed net"). Reuses all the ledger's audit + recompute.
   */
  async applyRule(ruleId: string, input: { studentId: string; chargeId: string }) {
    const rule = await this.repo.findDiscountRule(ruleId);
    if (!rule || !rule.isActive) throw new NotFoundException('Active discount rule not found');
    const value = Number(rule.value);
    return this.ledger.applyAdjustment({
      studentId: input.studentId,
      chargeId: input.chargeId,
      type: DISCOUNT_TO_ADJUSTMENT[rule.type],
      reason: rule.name,
      ...(rule.calc === 'PERCENT' ? { percent: value } : { amount: value }),
    });
  }

  // Grade fee schedules
  listGradeFees(academicYearId?: string) {
    return this.repo.listGradeFees(academicYearId);
  }
  createGradeFee(dto: CreateGradeFeeScheduleDto) {
    return this.repo.createGradeFee({
      gradeId: dto.gradeId,
      academicYearId: dto.academicYearId,
      registrationFee: dto.registrationFee,
      tuitionFee: dto.tuitionFee,
      effectiveFrom: new Date(dto.effectiveFrom),
      effectiveTo: date(dto.effectiveTo) ?? null,
      isActive: dto.isActive ?? true,
    });
  }
  updateGradeFee(id: string, dto: UpdateGradeFeeScheduleDto) {
    return this.repo.updateGradeFee(id, {
      ...(dto.gradeId !== undefined ? { grade: { connect: { id: dto.gradeId } } } : {}),
      ...(dto.academicYearId !== undefined
        ? { academicYear: { connect: { id: dto.academicYearId } } }
        : {}),
      ...(dto.registrationFee !== undefined ? { registrationFee: dto.registrationFee } : {}),
      ...(dto.tuitionFee !== undefined ? { tuitionFee: dto.tuitionFee } : {}),
      ...(dto.effectiveFrom !== undefined ? { effectiveFrom: new Date(dto.effectiveFrom) } : {}),
      ...(dto.effectiveTo !== undefined ? { effectiveTo: date(dto.effectiveTo) ?? null } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });
  }

  // Transport fares
  listTransportFares(academicYearId?: string) {
    return this.repo.listTransportFares(academicYearId);
  }
  createTransportFare(dto: CreateTransportFareDto) {
    return this.repo.createTransportFare({
      academicYearId: dto.academicYearId,
      amount: dto.amount,
      oneWayPct: dto.oneWayPct,
      isActive: dto.isActive ?? true,
      ...(dto.routeId !== undefined ? { routeId: dto.routeId } : {}),
      ...(dto.routeName !== undefined ? { routeName: dto.routeName } : {}),
    });
  }
  updateTransportFare(id: string, dto: UpdateTransportFareDto) {
    return this.repo.updateTransportFare(id, {
      ...(dto.academicYearId !== undefined ? { academicYearId: dto.academicYearId } : {}),
      ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
      ...(dto.oneWayPct !== undefined ? { oneWayPct: dto.oneWayPct } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.routeId !== undefined ? { routeId: dto.routeId } : {}),
      ...(dto.routeName !== undefined ? { routeName: dto.routeName } : {}),
    });
  }

  // Hard-delete a fare (the shared fleet route is preserved).
  async deleteTransportFare(id: string) {
    await this.repo.deleteTransportFare(id);
    return { id };
  }

  // Discount rules
  listDiscountRules() {
    return this.repo.listDiscountRules();
  }
  createDiscountRule(dto: CreateDiscountRuleDto) {
    if (dto.calc === 'PERCENT' && dto.value > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100');
    }
    return this.repo.createDiscountRule({
      name: dto.name,
      type: dto.type,
      calc: dto.calc,
      value: dto.value,
      maxAmount: dto.maxAmount ?? null,
      appliesToTransport: dto.appliesToTransport ?? false,
      startDate: date(dto.startDate) ?? null,
      endDate: date(dto.endDate) ?? null,
      isActive: dto.isActive ?? true,
    });
  }
  updateDiscountRule(id: string, dto: UpdateDiscountRuleDto) {
    if (dto.calc === 'PERCENT' && dto.value !== undefined && dto.value > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100');
    }
    return this.repo.updateDiscountRule(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.calc !== undefined ? { calc: dto.calc } : {}),
      ...(dto.value !== undefined ? { value: dto.value } : {}),
      ...(dto.maxAmount !== undefined ? { maxAmount: dto.maxAmount } : {}),
      ...(dto.appliesToTransport !== undefined
        ? { appliesToTransport: dto.appliesToTransport }
        : {}),
      ...(dto.startDate !== undefined ? { startDate: date(dto.startDate) ?? null } : {}),
      ...(dto.endDate !== undefined ? { endDate: date(dto.endDate) ?? null } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });
  }

  // Billing policy
  getPolicy() {
    return this.repo.getPolicy();
  }
  upsertPolicy(dto: UpsertBillingPolicyDto) {
    if (dto.minInstallments > dto.maxInstallments) {
      throw new BadRequestException('minInstallments cannot exceed maxInstallments');
    }
    return this.repo.upsertPolicy({
      minInstallments: dto.minInstallments,
      maxInstallments: dto.maxInstallments,
      fullPaymentDiscountPct: dto.fullPaymentDiscountPct,
      suspendTransportAfterOverdue: dto.suspendTransportAfterOverdue,
      suspendTransportAfterDays: dto.suspendTransportAfterDays ?? null,
      suspendTransportAfterAmount: dto.suspendTransportAfterAmount ?? null,
      ...(dto.allowSelfFeeApproval !== undefined
        ? { allowSelfFeeApproval: dto.allowSelfFeeApproval }
        : {}),
    });
  }
}
