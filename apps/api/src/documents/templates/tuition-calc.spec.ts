import { FeeItemKind } from '@prisma/client';
import { allocatePaidAcrossCategories } from './tuition-calc';

describe('allocatePaidAcrossCategories (Annual Tuition Certificate)', () => {
  const categories = [
    { kind: FeeItemKind.TUITION, net: '1000.000' },
    { kind: FeeItemKind.TRANSPORT, net: '300.000' },
    { kind: FeeItemKind.BOOKS, net: '100.000' },
  ];

  it('attributes payment to tuition first, capped at the tuition net', () => {
    const { allocations, grandTotal } = allocatePaidAcrossCategories(
      categories,
      '700.000',
      new Set(),
    );
    expect(allocations).toEqual([{ kind: FeeItemKind.TUITION, paid: '700.000', net: '1000.000' }]);
    expect(grandTotal).toBe('700.000');
  });

  it('caps tuition at its net and never spills into unselected categories', () => {
    const { allocations, grandTotal } = allocatePaidAcrossCategories(
      categories,
      '1300.000',
      new Set(),
    );
    expect(allocations).toHaveLength(1);
    expect(allocations[0]).toEqual({
      kind: FeeItemKind.TUITION,
      paid: '1000.000',
      net: '1000.000',
    });
    expect(grandTotal).toBe('1000.000');
  });

  it('includes selected optional categories after tuition, in order', () => {
    const { allocations, grandTotal } = allocatePaidAcrossCategories(
      categories,
      '1250.000',
      new Set([FeeItemKind.TRANSPORT, FeeItemKind.BOOKS]),
    );
    expect(allocations).toEqual([
      { kind: FeeItemKind.TUITION, paid: '1000.000', net: '1000.000' },
      { kind: FeeItemKind.TRANSPORT, paid: '250.000', net: '300.000' },
      { kind: FeeItemKind.BOOKS, paid: '0.000', net: '100.000' },
    ]);
    expect(grandTotal).toBe('1250.000');
  });

  it('always includes tuition even when not in the selected optional set', () => {
    const { allocations } = allocatePaidAcrossCategories(
      categories,
      '500.000',
      new Set([FeeItemKind.BOOKS]),
    );
    expect(allocations.map((a) => a.kind)).toEqual([FeeItemKind.TUITION, FeeItemKind.BOOKS]);
  });

  it('aggregates multiple lines of the same kind', () => {
    const { allocations } = allocatePaidAcrossCategories(
      [
        { kind: FeeItemKind.TUITION, net: '600.000' },
        { kind: FeeItemKind.TUITION, net: '400.000' },
      ],
      '1000.000',
      new Set(),
    );
    expect(allocations).toEqual([{ kind: FeeItemKind.TUITION, paid: '1000.000', net: '1000.000' }]);
  });

  it('handles zero payment', () => {
    const { allocations, grandTotal } = allocatePaidAcrossCategories(categories, '0', new Set());
    expect(allocations[0]).toEqual({ kind: FeeItemKind.TUITION, paid: '0.000', net: '1000.000' });
    expect(grandTotal).toBe('0.000');
  });
});
