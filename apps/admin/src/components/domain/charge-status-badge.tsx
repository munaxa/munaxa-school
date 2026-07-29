import { Badge } from '@axa/platform';

/**
 * Finance domain component: renders a charge/invoice status as a toned Badge.
 * Tone map is the single source of truth for charge-status colour across the app.
 */
const CHARGE_TONE: Record<string, 'success' | 'warning' | 'danger' | 'muted' | 'default'> = {
  PAID: 'success',
  PARTIAL: 'warning',
  PENDING: 'default',
  WAIVED: 'muted',
  CANCELLED: 'muted',
};

export function ChargeStatusBadge({ status }: { status: string }) {
  return <Badge tone={CHARGE_TONE[status] ?? 'default'}>{status}</Badge>;
}
