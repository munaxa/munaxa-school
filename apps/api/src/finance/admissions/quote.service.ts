import { BadRequestException, Injectable } from '@nestjs/common';
import { FeeItemKind, Prisma, QuotePaymentMode, TransportDirection } from '@prisma/client';
import { FeeConfigRepository } from '../fee-config/fee-config.repository';
import { splitFils } from '../shared/money';
import { AdmissionsRepository } from './admissions.repository';
import type { FeeOverrideDto, QuoteDto } from './admissions.dto';

const ZERO = new Prisma.Decimal(0);
const d = (v: Prisma.Decimal | string | number) => new Prisma.Decimal(v);

export interface QuoteLine {
  kind: FeeItemKind;
  feeItemId: string | null;
  label: string;
  amount: string;
  discountable: boolean;
  discountAmount: string;
  overridden: boolean;
  originalAmount: string | null;
}
export interface QuoteInstallment {
  index: number;
  dueDate: string;
  amount: string;
}
export interface ComputedQuote {
  academicYearId: string;
  gradeId: string;
  studentId: string | null;
  transportDirection: TransportDirection;
  paymentMode: QuotePaymentMode;
  installments: number;
  firstDueDate: string | null;
  lines: QuoteLine[];
  totalFees: string;
  discountEligible: string;
  nonDiscountEligible: string;
  discountAmount: string;
  grandTotal: string;
  schedule: QuoteInstallment[];
  feeModified: boolean;
  warnings: string[];
}

/**
 * Admissions quote engine (Phase 22). Composes the full fee catalog (GradeFeeItem, with a
 * backward-compatible fallback to GradeFeeSchedule registration/tuition) + transport fare into a
 * line-item quotation, applies the full-payment discount to **discountable lines only**, supports
 * registrar overrides, and previews the installment schedule on the grand total. Pure calculation;
 * persistence is delegated to {@link AdmissionsRepository.createQuote}.
 */
@Injectable()
export class QuoteService {
  constructor(
    private readonly config: FeeConfigRepository,
    private readonly repo: AdmissionsRepository,
  ) {}

  private addMonths(base: Date, n: number): Date {
    const dt = new Date(base);
    const day = dt.getDate();
    dt.setDate(1);
    dt.setMonth(dt.getMonth() + n);
    const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
    dt.setDate(Math.min(day, last));
    return dt;
  }

  async compute(dto: QuoteDto): Promise<ComputedQuote> {
    const warnings: string[] = [];
    const direction = dto.transportDirection ?? TransportDirection.NONE;
    const paymentMode = dto.paymentMode ?? QuotePaymentMode.INSTALLMENTS;
    const today = new Date();

    // 1) Base fee lines from the catalog (effective today), else fall back to GradeFeeSchedule.
    const lines: QuoteLine[] = [];
    const gradeFeeItems = await this.repo.listActiveGradeFeeItems(dto.academicYearId, dto.gradeId);
    if (gradeFeeItems.length > 0) {
      for (const gfi of gradeFeeItems) {
        lines.push({
          kind: gfi.feeItem.kind,
          feeItemId: gfi.feeItemId,
          label: gfi.feeItem.nameEn,
          amount: d(gfi.amount).toFixed(3),
          discountable: gfi.discountable,
          discountAmount: '0.000',
          overridden: false,
          originalAmount: null,
        });
      }
    } else {
      const schedules = (await this.config.listGradeFees(dto.academicYearId)).filter(
        (s) =>
          s.gradeId === dto.gradeId &&
          s.isActive &&
          s.effectiveFrom <= today &&
          (s.effectiveTo === null || s.effectiveTo >= today),
      );
      const schedule = schedules[0];
      if (!schedule) {
        throw new BadRequestException(
          'No fee items or fee schedule for this grade and academic year. Configure fees first.',
        );
      }
      lines.push({
        kind: FeeItemKind.REGISTRATION,
        feeItemId: null,
        label: 'Registration fee',
        amount: d(schedule.registrationFee).toFixed(3),
        discountable: false,
        discountAmount: '0.000',
        overridden: false,
        originalAmount: null,
      });
      lines.push({
        kind: FeeItemKind.TUITION,
        feeItemId: null,
        label: 'Annual tuition',
        amount: d(schedule.tuitionFee).toFixed(3),
        discountable: true,
        discountAmount: '0.000',
        overridden: false,
        originalAmount: null,
      });
    }

    // 2) Transport (never discountable). One fare per route holds the two-way total + one-way %;
    // the chosen direction decides which portion applies.
    const routeName = dto.transportRouteGroup?.trim();
    if (direction !== TransportDirection.NONE) {
      const fares = (await this.config.listTransportFares(dto.academicYearId)).filter(
        (f) => f.isActive && !f.route?.disabledAt,
      );
      const fare = routeName ? fares.find((f) => f.route?.name === routeName) : fares[0];
      if (!fare) {
        warnings.push(
          routeName
            ? `No transport fare configured for route "${routeName}"; using 0.`
            : 'No transport fare configured; using 0.',
        );
      }
      const total = d(fare?.amount ?? 0);
      const fee =
        direction === TransportDirection.ONE_WAY
          ? total.mul(d(fare?.oneWayPct ?? 100)).div(100)
          : total;
      const label = fare?.route?.name
        ? `Transportation (${fare.route.name} · ${direction.replace('_', ' ')})`
        : `Transportation (${direction.replace('_', ' ')})`;
      lines.push({
        kind: FeeItemKind.TRANSPORT,
        feeItemId: null,
        label,
        amount: fee.toDecimalPlaces(3).toFixed(3),
        discountable: false,
        discountAmount: '0.000',
        overridden: false,
        originalAmount: null,
      });
    }

    // 3) Registrar overrides (mark feeModified).
    let feeModified = false;
    for (const ov of dto.overrides ?? []) {
      const line = lines.find((l) => l.kind === ov.kind);
      if (!line) {
        warnings.push(`Override for ${ov.kind} ignored — no such fee line in this quote.`);
        continue;
      }
      if (d(ov.amount).toFixed(3) !== line.amount) {
        line.originalAmount = line.amount;
        line.amount = d(ov.amount).toFixed(3);
        line.overridden = true;
        feeModified = true;
      }
    }

    // 4) Full-payment discount applies to discountable lines only.
    let discountAmount = ZERO;
    if (paymentMode === QuotePaymentMode.FULL) {
      const policy = await this.config.getPolicy();
      const pct = d(policy?.fullPaymentDiscountPct ?? 0);
      for (const line of lines) {
        if (line.discountable) {
          const da = d(line.amount).mul(pct).div(100).toDecimalPlaces(3);
          line.discountAmount = da.toFixed(3);
          discountAmount = discountAmount.plus(da);
        }
      }
    }

    // 5) Totals.
    const totalFees = lines.reduce((acc, l) => acc.plus(d(l.amount)), ZERO);
    const discountEligible = lines.reduce(
      (acc, l) => (l.discountable ? acc.plus(d(l.amount)) : acc),
      ZERO,
    );
    const nonDiscountEligible = totalFees.minus(discountEligible);
    const grandTotal = totalFees.minus(discountAmount).toDecimalPlaces(3);

    // 6) Installment schedule preview (on the grand total) when not paying in full.
    const policy = await this.config.getPolicy();
    const minI = policy?.minInstallments ?? 1;
    const maxI = policy?.maxInstallments ?? 9;
    let installments = paymentMode === QuotePaymentMode.FULL ? 1 : (dto.installments ?? 1);
    const schedule: QuoteInstallment[] = [];
    if (paymentMode === QuotePaymentMode.INSTALLMENTS) {
      if (installments < minI || installments > maxI) {
        throw new BadRequestException(`Installments must be between ${minI} and ${maxI}.`);
      }
      const base = dto.firstDueDate ? new Date(dto.firstDueDate) : new Date();
      const totalFils = grandTotal.mul(1000).toNearest(1).toNumber();
      const parts = splitFils(totalFils, installments); // shared single source
      for (let i = 0; i < installments; i += 1) {
        const due = this.addMonths(base, i);
        schedule.push({
          index: i + 1,
          dueDate: due.toISOString().slice(0, 10),
          amount: d(parts[i]!).div(1000).toFixed(3),
        });
      }
    } else {
      installments = 1;
    }

    return {
      academicYearId: dto.academicYearId,
      gradeId: dto.gradeId,
      studentId: dto.studentId ?? null,
      transportDirection: direction,
      paymentMode,
      installments,
      firstDueDate: dto.firstDueDate ?? null,
      lines,
      totalFees: totalFees.toFixed(3),
      discountEligible: discountEligible.toFixed(3),
      nonDiscountEligible: nonDiscountEligible.toFixed(3),
      discountAmount: discountAmount.toFixed(3),
      grandTotal: grandTotal.toFixed(3),
      schedule,
      feeModified,
      warnings,
    };
  }

  /** Compute + optionally persist. Returns the computed quote and the persisted id (when saved). */
  async quote(dto: QuoteDto): Promise<ComputedQuote & { quoteId?: string }> {
    const computed = await this.compute(dto);
    if (dto.persist) {
      const saved = await this.repo.createQuote(computed, dto.overrides ?? []);
      return { ...computed, quoteId: saved.id };
    }
    return computed;
  }

  /** Sum of overridden line differences, for audit/reporting. */
  static overrideDelta(overrides: FeeOverrideDto[]): number {
    return overrides.reduce((acc, o) => acc + o.amount, 0);
  }
}
