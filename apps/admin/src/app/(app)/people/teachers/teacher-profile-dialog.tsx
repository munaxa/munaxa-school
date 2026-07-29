'use client';

import { useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import { EmploymentStatusBadge, RecordHeader } from '@/components/domain';
import type { Teacher } from '@/lib/people';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@axa/platform';

/**
 * Read-only teacher profile shown when a teacher name is clicked in the unified Staff directory.
 * Mirrors the employee profile dialog. Teaching assignments stay managed on the Teachers tab.
 */
export function TeacherProfileDialog({
  teacher,
  onClose,
}: {
  teacher: Teacher;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const initials = `${teacher.firstNameEn[0] ?? ''}${teacher.lastNameEn[0] ?? ''}`.toUpperCase();
  const [tab, setTab] = useState('overview');

  return (
    <div className="fixed inset-0 z-modal flex items-start justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-foreground/40" onClick={onClose} aria-hidden="true" />
      <div
        className="relative my-8 w-full max-w-2xl space-y-4 rounded-xl border border-border bg-card p-5 shadow-card"
        role="dialog"
        aria-modal="true"
      >
        {/* Identity header */}
        <RecordHeader
          initials={initials}
          title={`${teacher.firstNameEn} ${teacher.lastNameEn}`}
          subtitle={
            <span dir="rtl" className="text-muted-foreground">
              {teacher.firstNameAr} {teacher.lastNameAr}
            </span>
          }
          badges={
            <>
              <EmploymentStatusBadge status={teacher.status} />
              <Badge tone="muted">{t('people.typeTeacher')}</Badge>
              {teacher.specialization ? <Badge tone="muted">{teacher.specialization}</Badge> : null}
            </>
          }
          actions={
            <Button variant="ghost" size="sm" onClick={onClose} aria-label={t('common.cancel')}>
              ✕
            </Button>
          }
        />

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">{t('people.teacherDetails')}</TabsTrigger>
            <TabsTrigger value="assignments">{t('people.teachersTab')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>{t('people.teacherDetails')}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                <Detail label={t('people.specialization')} value={teacher.specialization} />
                <Detail label={t('people.employeeNumber')} value={teacher.employeeNumber} mono />
                <Detail label={t('common.status')} value={teacher.status} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assignments">
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                {t('people.manageInTeachers')}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null | undefined;
  mono?: boolean | undefined;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`text-sm ${mono ? 'font-mono' : ''}`}>{value || '—'}</div>
    </div>
  );
}
