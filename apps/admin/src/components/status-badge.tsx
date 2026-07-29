import { Badge } from '@axa/platform';
import type { EmploymentStatus } from '@/lib/people';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'muted';

const TONE: Record<EmploymentStatus, Tone> = {
  CANDIDATE: 'default',
  INTERVIEW: 'default',
  OFFER_SENT: 'default',
  BACKGROUND_CHECK: 'default',
  OFFER_ACCEPTED: 'default',
  HIRED: 'success',
  PROBATION: 'warning',
  ACTIVE: 'success',
  TRANSFERRED: 'default',
  PROMOTION: 'success',
  ON_LEAVE: 'warning',
  SUSPENDED: 'warning',
  RETIRED: 'muted',
  RESIGNED: 'muted',
  TERMINATED: 'danger',
  ARCHIVED: 'muted',
};

const LABEL: Record<EmploymentStatus, string> = {
  CANDIDATE: 'Candidate',
  INTERVIEW: 'Interview',
  OFFER_SENT: 'Offer sent',
  BACKGROUND_CHECK: 'Background check',
  OFFER_ACCEPTED: 'Offer accepted',
  HIRED: 'Hired',
  PROBATION: 'Probation',
  ACTIVE: 'Active',
  TRANSFERRED: 'Transferred',
  PROMOTION: 'Promotion',
  ON_LEAVE: 'On leave',
  SUSPENDED: 'Suspended',
  RETIRED: 'Retired',
  RESIGNED: 'Resigned',
  TERMINATED: 'Terminated',
  ARCHIVED: 'Archived',
};

/** Human-readable label for an employment status. */
export function employmentStatusLabel(status: EmploymentStatus): string {
  return LABEL[status] ?? status;
}

/** Renders an employment status as a colored badge. */
export function StatusBadge({ status }: { status: EmploymentStatus }) {
  return <Badge tone={TONE[status] ?? 'default'}>{LABEL[status] ?? status}</Badge>;
}
