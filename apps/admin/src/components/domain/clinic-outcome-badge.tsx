import { Badge } from '@axa/platform';
import type { ClinicOutcome } from '@/lib/advanced';

/** Clinic domain component: renders a visit outcome as a toned Badge. */
const OUTCOME_TONE: Record<ClinicOutcome, 'success' | 'warning' | 'danger' | 'muted'> = {
  RESOLVED: 'success',
  SENT_HOME: 'warning',
  REFERRED: 'warning',
  HOSPITALIZED: 'danger',
};

export function ClinicOutcomeBadge({ outcome }: { outcome: ClinicOutcome }) {
  return <Badge tone={OUTCOME_TONE[outcome]}>{outcome.replace('_', ' ')}</Badge>;
}
