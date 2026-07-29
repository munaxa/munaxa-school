'use client';

import { useI18n } from '@/components/i18n-provider';
import { Card, CardContent, EmptyState } from '@axa/platform';

/**
 * Graceful placeholder for tabs whose per-student data source isn't wired into the profile yet
 * (e.g. Academics, Attendance, Medical, Communication, Timeline, Audit Log). Keeps the unified
 * tab layout complete without fabricating data — each is lazy-loaded so it costs nothing until
 * opened.
 */
export function PlaceholderTab({ titleKey }: { titleKey: string }) {
  const { t } = useI18n();
  return (
    <Card>
      <CardContent className="py-4">
        <EmptyState title={t(titleKey)} description={t('studentProfile.tabComingSoon')} />
      </CardContent>
    </Card>
  );
}
