import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ZERO } from '../shared/money';

/** An open installment an allocation policy may draw against. */
export interface AllocatableInstallment {
  id: string;
  dueDate: Date | null;
  seq: number;
  balance: Prisma.Decimal;
}

/** A resulting allocation the engine will apply. */
export interface AllocationLine {
  installmentId: string;
  amount: Prisma.Decimal;
}

/**
 * Allocation strategy port (AR-8, ADR-005). v1.0 ships exactly one policy —
 * FIFO_BY_DUE_DATE — as the default and only implementation; PROPORTIONAL /
 * SPECIFIC_INSTALLMENT / CROSS_STUDENT are declared, unimplemented seams. Callers pass the
 * open installments and an amount; the policy returns the lines to apply (it never writes).
 */
export interface AllocationPolicy {
  readonly name: string;
  allocate(amount: Prisma.Decimal, installments: AllocatableInstallment[]): AllocationLine[];
}

/** Earliest due date first; ties broken by seq. Undated installments settle last (AR-2). */
@Injectable()
export class FifoByDueDatePolicy implements AllocationPolicy {
  readonly name = 'FIFO_BY_DUE_DATE';

  allocate(amount: Prisma.Decimal, installments: AllocatableInstallment[]): AllocationLine[] {
    const ordered = [...installments].sort((a, b) => {
      const da = a.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
      const db = b.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return a.seq - b.seq;
    });
    const lines: AllocationLine[] = [];
    let remaining = amount;
    for (const inst of ordered) {
      if (remaining.lessThanOrEqualTo(ZERO)) break;
      if (inst.balance.lessThanOrEqualTo(ZERO)) continue;
      const take = Prisma.Decimal.min(inst.balance, remaining);
      lines.push({ installmentId: inst.id, amount: take });
      remaining = remaining.minus(take);
    }
    return lines;
  }
}
