import { BadRequestException, Injectable } from '@nestjs/common';
import type { PaymentPlanCadence } from '@prisma/client';
import { splitFils, toFils } from '../shared/money';

/** One generated schedule line (amounts in integer fils). */
export interface ScheduleLine {
  seq: number;
  dueDate: Date;
  amountFils: number;
}

export interface ScheduleOptions {
  cadence: PaymentPlanCadence;
  installments: number;
  firstDueDate: string; // ISO date (YYYY-MM-DD)
  balloonFinal?: boolean;
  /** CUSTOM cadence: explicit lines (amounts in JOD). Their sum must equal the net. */
  customLines?: Array<{ dueDate: string; amount: number }>;
  /** ISO dates (YYYY-MM-DD) to skip — a due date landing on one shifts forward a day (IR-4). */
  holidays?: string[];
}

function parseIso(iso: string): Date {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new BadRequestException(`Invalid date: ${iso}`);
  return d;
}

/** Add `n` whole months, clamping the day to the target month's length. */
export function addMonths(base: Date, n: number): Date {
  const day = base.getUTCDate();
  const target = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + n, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

export function addDays(base: Date, n: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

/**
 * The single installment-schedule generator (IR-1). Splits a charge net into N scheduled
 * installments whose amounts sum **exactly** to the net (fils arithmetic, remainder to the last
 * installment or concentrated there for a balloon). Supports monthly/weekly/quarterly/custom
 * cadences, deferred first payment (via firstDueDate) and holiday skipping. No other module
 * generates schedules — charges and admissions both call this (removes the historical duplication).
 */
@Injectable()
export class InstallmentScheduleService {
  /** Generate schedule lines for a charge net (in fils). Guarantees Σ amountFils === netFils. */
  generate(netFils: number, opts: ScheduleOptions): ScheduleLine[] {
    if (netFils <= 0) throw new BadRequestException('Cannot schedule a non-positive net');

    if (opts.cadence === 'CUSTOM') return this.custom(netFils, opts);

    const count = opts.installments;
    if (!Number.isInteger(count) || count < 1) {
      throw new BadRequestException('installments must be a positive integer');
    }
    const holidays = new Set(opts.holidays ?? []);
    const first = parseIso(opts.firstDueDate);

    // Split in fils so the parts always reconstruct the exact net.
    const amounts = this.splitFils(netFils, count, opts.balloonFinal ?? false);

    return amounts.map((amountFils, i) => ({
      seq: i + 1,
      dueDate: this.skipHolidays(this.stepDate(first, opts.cadence, i), holidays),
      amountFils,
    }));
  }

  private stepDate(first: Date, cadence: PaymentPlanCadence, i: number): Date {
    switch (cadence) {
      case 'MONTHLY':
        return addMonths(first, i);
      case 'WEEKLY':
        return addDays(first, 7 * i);
      case 'QUARTERLY':
        return addMonths(first, 3 * i);
      default:
        return addMonths(first, i);
    }
  }

  private skipHolidays(date: Date, holidays: Set<string>): Date {
    let d = date;
    // Bounded shift (max a fortnight) so a mis-configured holiday list can't loop forever.
    for (let guard = 0; guard < 14; guard += 1) {
      const iso = d.toISOString().slice(0, 10);
      if (!holidays.has(iso)) return d;
      d = addDays(d, 1);
    }
    return d;
  }

  /**
   * Split `netFils` into `count` parts. Normal: equal parts, remainder to the last installment.
   * Balloon: the first count-1 parts are smaller (floor(net/(count+1))) so the final one is
   * distinctly larger and carries the remainder (BR-13, IR-4).
   */
  private splitFils(netFils: number, count: number, balloon: boolean): number[] {
    if (!balloon) return splitFils(netFils, count); // shared equal-split (remainder to last)
    if (count === 1) return [netFils];
    // Balloon: smaller equal parts, the final installment carries the larger remainder.
    const per = Math.floor(netFils / (count + 1));
    const parts: number[] = [];
    for (let i = 0; i < count - 1; i += 1) parts.push(per);
    parts.push(netFils - per * (count - 1));
    return parts;
  }

  private custom(netFils: number, opts: ScheduleOptions): ScheduleLine[] {
    const lines = opts.customLines ?? [];
    if (lines.length === 0) throw new BadRequestException('CUSTOM cadence requires customLines');
    const holidays = new Set(opts.holidays ?? []);
    const mapped = lines.map((l, i) => ({
      seq: i + 1,
      dueDate: this.skipHolidays(parseIso(l.dueDate), holidays),
      amountFils: toFils(l.amount),
    }));
    const sum = mapped.reduce((s, l) => s + l.amountFils, 0);
    if (sum !== netFils) {
      throw new BadRequestException(
        `Custom installments (${sum} fils) must sum to the charge net (${netFils} fils)`,
      );
    }
    return mapped;
  }
}
