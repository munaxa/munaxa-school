import { Badge } from '@axa/platform';

/** Library domain component: renders a book-loan status as a toned Badge. */
const LOAN_TONE: Record<string, 'default' | 'danger' | 'muted'> = {
  ACTIVE: 'default',
  OVERDUE: 'danger',
  RETURNED: 'muted',
};

export function LoanStatusBadge({ status }: { status: string }) {
  return <Badge tone={LOAN_TONE[status] ?? 'muted'}>{status}</Badge>;
}
