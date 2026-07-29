import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FeeConfigRepository } from '../fee-config/fee-config.repository';
import { splitFils } from '../shared/money';
import type { QuoteDto } from './enrollment.dto';

const ZERO = new Prisma.Decimal(0);
const d = (v: Prisma.Decimal | string | number) => new Prisma.Decimal(v);

export interface QuoteLine {
  key: 'registration' | 'tuition' | 'transport' | 'discount';
  amount: string;
}
export interface QuoteInstallment {
  index: number;
  dueDate: string;
  amount: string;
}
export interface EnrollmentQuote {
  registrationFee: string;
  tuitionFee: string;
  tuitionDiscount: string;
  transportFee: string;
  total: string;
  fullPayment: boolean;
  installments: number;
  lines: QuoteLine[];
  schedule: QuoteInstallment[];
  warnings: string[];
}

/**
 * Enrollment quote engine (Phase 2). Read-only composition of the configuration layer into the
 * spec fee formula and an installment schedule preview. Performs no writes; the registrar reviews
 * a quote, then enrollment creates the charges via the existing finance endpoints.
 */
@Injectable()
export class EnrollmentService {
  constructor(private readonly config: FeeConfigRepository) {}

  private addMonths(base: Date, n: number): Date {
    const dt = new Date(base);
    const day = dt.getDate();
    dt.setDate(1);
    dt.setMonth(dt.getMonth() + n);
    // Clamp to the month length (e.g. Jan 31 + 1mo → Feb 28/29).
    const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
    dt.setDate(Math.min(day, last));
    return dt;
  }

  async quote(dto: QuoteDto): Promise<EnrollmentQuote> {
    const warnings: string[] = [];
    const direction = dto.transportDirection ?? 'NONE';

    // Effective grade fee schedule for this grade + academic year (latest active, dated today).
    const today = new Date();
    const schedules = (await this.config.listGradeFees(dto.academicYearId)).filter(
      (s) =>
        s.gradeId === dto.gradeId &&
        s.isActive &&
        s.effectiveFrom <= today &&
        (s.effectiveTo === null || s.effectiveTo >= today),
    );
    const schedule = schedules[0] ?? null; // listGradeFees orders by effectiveFrom desc
    if (!schedule) {
      throw new BadRequestException(
        'No active fee schedule for this grade and academic year. Configure it under Fee configuration.',
      );
    }
    const registration = d(schedule.registrationFee);
    const tuition = d(schedule.tuitionFee);

    // Transport fare (0 for NONE): one fare per route holds the two-way total + one-way %, so the
    // direction decides which portion applies.
    let transport = ZERO;
    if (direction !== 'NONE') {
      const routeName = dto.transportRouteGroup?.trim();
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
      } else {
        const total = d(fare.amount);
        transport = direction === 'ONE_WAY' ? total.mul(d(fare.oneWayPct)).div(100) : total;
      }
    }

    // Policy: installment bounds + full-payment discount.
    const policy = await this.config.getPolicy();
    const minI = policy?.minInstallments ?? 1;
    const maxI = policy?.maxInstallments ?? 9;
    const fullPayment = dto.fullPayment ?? false;

    // Full-payment discount applies to TUITION ONLY (never registration/transport).
    let tuitionDiscount = ZERO;
    if (fullPayment) {
      const pct = d(policy?.fullPaymentDiscountPct ?? 0);
      tuitionDiscount = tuition.mul(pct).div(100).toDecimalPlaces(3);
    }
    const tuitionNet = tuition.minus(tuitionDiscount);
    const total = tuitionNet.plus(registration).plus(transport).toDecimalPlaces(3);

    // Installment schedule (on the net tuition) when not paying in full.
    let installments = fullPayment ? 1 : (dto.installments ?? 1);
    const schedulePreview: QuoteInstallment[] = [];
    if (!fullPayment) {
      if (installments < minI || installments > maxI) {
        throw new BadRequestException(`Installments must be between ${minI} and ${maxI}.`);
      }
      const base = dto.firstDueDate ? new Date(dto.firstDueDate) : new Date();
      // Split net tuition into integer-fils parts (shared single source; last absorbs remainder).
      const totalFils = tuitionNet.mul(1000).toNearest(1).toNumber();
      const parts = splitFils(totalFils, installments);
      for (let i = 0; i < installments; i += 1) {
        schedulePreview.push({
          index: i + 1,
          dueDate: this.addMonths(base, i).toISOString().slice(0, 10),
          amount: d(parts[i]!).div(1000).toFixed(3),
        });
      }
    } else {
      installments = 1;
    }

    return {
      registrationFee: registration.toFixed(3),
      tuitionFee: tuition.toFixed(3),
      tuitionDiscount: tuitionDiscount.toFixed(3),
      transportFee: transport.toFixed(3),
      total: total.toFixed(3),
      fullPayment,
      installments,
      lines: [
        { key: 'registration', amount: registration.toFixed(3) },
        { key: 'tuition', amount: tuition.toFixed(3) },
        ...(tuitionDiscount.greaterThan(ZERO)
          ? [{ key: 'discount' as const, amount: tuitionDiscount.negated().toFixed(3) }]
          : []),
        { key: 'transport', amount: transport.toFixed(3) },
      ],
      schedule: schedulePreview,
      warnings,
    };
  }
}
