import type { FeeItemKind } from '@prisma/client';
import { TUITION_KINDS } from './fee-labels';

export interface CategoryCharge {
  kind: FeeItemKind;
  /** Net charged for this category in the selected academic year (gross − discounts), 3dp string. */
  net: string;
}

export interface AllocatedCategory {
  kind: FeeItemKind;
  /** How much of the money paid is attributed to this category (3dp string). */
  paid: string;
  net: string;
}

/**
 * Annual Tuition Certificate allocation (Part 6). Money actually paid (from the ledger) is
 * attributed across the *selected* fee categories in a deterministic priority order — tuition first,
 * then the chosen optional categories — capped at each category's net charge. This produces a
 * defensible "how much of what you paid went to tuition (and optionally X, Y, Z)" figure from the
 * billing ledger, with no manual typing. Tuition is always included.
 *
 * @returns per-category attributed amounts (in `selected` order) and the grand total attributed.
 */
export function allocatePaidAcrossCategories(
  categories: CategoryCharge[],
  totalPaid: string | number,
  selectedOptionalKinds: ReadonlySet<FeeItemKind>,
): { allocations: AllocatedCategory[]; grandTotal: string } {
  // Aggregate net per kind (a year can have several lines of the same kind).
  const netByKind = new Map<FeeItemKind, number>();
  for (const c of categories) {
    netByKind.set(c.kind, (netByKind.get(c.kind) ?? 0) + Number(c.net));
  }

  // Selection: tuition is mandatory; the rest are the registrar-chosen optional categories.
  const ordered: FeeItemKind[] = [];
  for (const k of netByKind.keys()) {
    if (TUITION_KINDS.has(k)) ordered.push(k);
  }
  for (const k of netByKind.keys()) {
    if (!TUITION_KINDS.has(k) && selectedOptionalKinds.has(k)) ordered.push(k);
  }

  let remainingFils = Math.round(Number(totalPaid) * 1000);
  const allocations: AllocatedCategory[] = [];
  for (const kind of ordered) {
    const netFils = Math.round((netByKind.get(kind) ?? 0) * 1000);
    const take = Math.max(0, Math.min(netFils, remainingFils));
    remainingFils -= take;
    allocations.push({
      kind,
      paid: (take / 1000).toFixed(3),
      net: (netFils / 1000).toFixed(3),
    });
  }
  const grandFils = allocations.reduce((s, a) => s + Math.round(Number(a.paid) * 1000), 0);
  return { allocations, grandTotal: (grandFils / 1000).toFixed(3) };
}
