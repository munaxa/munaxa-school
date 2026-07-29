'use client';

import { useI18n } from '@/components/i18n-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@axa/platform';
import { Vaccines } from '../../student-editor';

/** Government vaccines tab — reuses the shared, editable Vaccines manager. */
export function VaccinesTab({ studentId }: { studentId: string }) {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('people.vaccines')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Vaccines studentId={studentId} />
      </CardContent>
    </Card>
  );
}
