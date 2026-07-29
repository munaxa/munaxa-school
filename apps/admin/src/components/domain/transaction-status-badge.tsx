import { Badge } from '@axa/platform';

/**
 * Finance domain component: renders a payment/transaction status as a toned Badge.
 * Single source of truth for transaction-status colour across the app.
 */
const TXN_TONE: Record<string, 'success' | 'warning' | 'danger' | 'muted'> = {
  VERIFIED: 'success',
  PENDING: 'warning',
  REJECTED: 'danger',
};

export function TransactionStatusBadge({ status }: { status: string }) {
  return <Badge tone={TXN_TONE[status] ?? 'muted'}>{status}</Badge>;
}
