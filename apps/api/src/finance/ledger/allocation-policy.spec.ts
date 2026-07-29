import { Prisma } from '@prisma/client';
import { FifoByDueDatePolicy, type AllocatableInstallment } from './allocation-policy';

const D = (n: number) => new Prisma.Decimal(n);
const inst = (
  id: string,
  balance: number,
  dueDate: Date | null,
  seq = 0,
): AllocatableInstallment => ({ id, balance: D(balance), dueDate, seq });

/** AR-2 : FIFO by due date; caps per installment balance; undated last. */
describe('FifoByDueDatePolicy', () => {
  const policy = new FifoByDueDatePolicy();

  it('settles earliest-due installments first, capping at each balance', () => {
    const lines = policy.allocate(D(150), [
      inst('b', 100, new Date('2026-10-01'), 2),
      inst('a', 100, new Date('2026-09-01'), 1),
    ]);
    expect(lines).toEqual([
      { installmentId: 'a', amount: D(100) },
      { installmentId: 'b', amount: D(50) },
    ]);
  });

  it('stops once the amount is exhausted (partial final line)', () => {
    const lines = policy.allocate(D(30), [inst('a', 100, new Date('2026-09-01'))]);
    expect(lines).toEqual([{ installmentId: 'a', amount: D(30) }]);
  });

  it('returns nothing to allocate when there are no open installments', () => {
    expect(policy.allocate(D(50), [])).toEqual([]);
  });

  it('leaves a residue unallocated when installments cannot absorb the full amount', () => {
    const lines = policy.allocate(D(250), [
      inst('a', 100, new Date('2026-09-01'), 1),
      inst('b', 100, new Date('2026-10-01'), 2),
    ]);
    const allocated = lines.reduce((s, l) => s.plus(l.amount), new Prisma.Decimal(0));
    expect(allocated.toString()).toBe('200'); // 50 residue → over-payment credit (AR-5)
  });

  it('orders undated installments last, ties broken by seq', () => {
    const lines = policy.allocate(D(300), [
      inst('undated', 100, null, 5),
      inst('later', 100, new Date('2026-10-01'), 3),
      inst('earlier', 100, new Date('2026-09-01'), 2),
    ]);
    expect(lines.map((l) => l.installmentId)).toEqual(['earlier', 'later', 'undated']);
  });
});
