import { BadRequestException } from '@nestjs/common';
import { InstallmentScheduleService } from './installment-schedule.service';

/** IR-* : the schedule generator must always reconstruct the exact net (fils), across cadences. */
describe('InstallmentScheduleService', () => {
  const svc = new InstallmentScheduleService();
  const sum = (lines: { amountFils: number }[]) => lines.reduce((s, l) => s + l.amountFils, 0);

  it('splits an evenly-divisible total into equal monthly installments', () => {
    const lines = svc.generate(900_000, {
      cadence: 'MONTHLY',
      installments: 9,
      firstDueDate: '2026-09-01',
    });
    expect(lines).toHaveLength(9);
    expect(lines.every((l) => l.amountFils === 100_000)).toBe(true);
    expect(sum(lines)).toBe(900_000);
  });

  it('puts the rounding remainder on the last installment (Σ == net, BR-9/IR-2)', () => {
    const net = 1_000_000; // 1000.000 JOD over 3 → 333.333 × 2 + 333.334
    const lines = svc.generate(net, {
      cadence: 'MONTHLY',
      installments: 3,
      firstDueDate: '2026-09-01',
    });
    expect(lines.map((l) => l.amountFils)).toEqual([333_333, 333_333, 333_334]);
    expect(sum(lines)).toBe(net);
  });

  it('advances due dates by cadence (monthly / weekly / quarterly)', () => {
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const monthly = svc.generate(300_000, {
      cadence: 'MONTHLY',
      installments: 3,
      firstDueDate: '2026-01-31',
    });
    // Jan 31 → Feb 28 (clamped) → Mar 31.
    expect(monthly.map((l) => iso(l.dueDate))).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);

    const weekly = svc.generate(200_000, {
      cadence: 'WEEKLY',
      installments: 2,
      firstDueDate: '2026-01-01',
    });
    expect(weekly.map((l) => iso(l.dueDate))).toEqual(['2026-01-01', '2026-01-08']);

    const quarterly = svc.generate(200_000, {
      cadence: 'QUARTERLY',
      installments: 2,
      firstDueDate: '2026-01-15',
    });
    expect(quarterly.map((l) => iso(l.dueDate))).toEqual(['2026-01-15', '2026-04-15']);
  });

  it('concentrates the remainder in a larger final balloon installment', () => {
    const lines = svc.generate(1_000_000, {
      cadence: 'MONTHLY',
      installments: 4,
      firstDueDate: '2026-09-01',
      balloonFinal: true,
    });
    expect(sum(lines)).toBe(1_000_000);
    const last = lines[lines.length - 1]!.amountFils;
    expect(lines.slice(0, -1).every((l) => l.amountFils < last)).toBe(true);
  });

  it('skips holidays by shifting the due date forward', () => {
    const lines = svc.generate(100_000, {
      cadence: 'MONTHLY',
      installments: 1,
      firstDueDate: '2026-09-01',
      holidays: ['2026-09-01', '2026-09-02'],
    });
    expect(lines[0]!.dueDate.toISOString().slice(0, 10)).toBe('2026-09-03');
  });

  it('accepts CUSTOM lines that sum to the net and rejects those that do not', () => {
    const ok = svc.generate(500_000, {
      cadence: 'CUSTOM',
      installments: 0,
      firstDueDate: '2026-09-01',
      customLines: [
        { dueDate: '2026-09-01', amount: 200 },
        { dueDate: '2026-10-01', amount: 300 },
      ],
    });
    expect(sum(ok)).toBe(500_000);
    expect(() =>
      svc.generate(500_000, {
        cadence: 'CUSTOM',
        installments: 0,
        firstDueDate: '2026-09-01',
        customLines: [{ dueDate: '2026-09-01', amount: 200 }],
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects a non-positive net', () => {
    expect(() =>
      svc.generate(0, { cadence: 'MONTHLY', installments: 3, firstDueDate: '2026-09-01' }),
    ).toThrow(BadRequestException);
  });
});
