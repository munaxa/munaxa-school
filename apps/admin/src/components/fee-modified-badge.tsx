'use client';

import { Badge } from '@axa/platform';

/**
 * Permanent financial flag shown wherever a student's finances surface (profile, finance card,
 * billing ledger, enrollment record, reports). Renders nothing when the student is on standard
 * terms. Driven by StudentBillingProfile.feeModified / customArrangement.
 */
export function FeeModifiedBadge({
  feeModified,
  customArrangement,
}: {
  feeModified?: boolean;
  customArrangement?: boolean;
}) {
  if (customArrangement) return <Badge tone="warning">Custom Financial Arrangement</Badge>;
  if (feeModified) return <Badge tone="warning">Fee Modified</Badge>;
  return null;
}
