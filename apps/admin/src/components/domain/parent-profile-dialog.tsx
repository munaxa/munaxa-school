'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/i18n-provider';
import { financeApi, type ParentStudent } from '@/lib/finance';
import { type Parent, type Student } from '@/lib/people';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Spinner,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@axa/platform';
import { RecordHeader } from './record-header';

/**
 * Parent profile — the "related records" drill-down opened by clicking a parent name.
 * Shows the guardian's contact details and their students (children) with each one's grade,
 * transport demand and outstanding balance. Clicking a student opens that student's profile.
 * Students + balances come from the finance parent-students endpoint (keyed by the parent id).
 */
export function ParentProfileDialog({
  parent,
  contextStudent,
  onClose,
  onEdit,
}: {
  parent: Parent;
  contextStudent?: Student | undefined;
  onClose: () => void;
  onEdit?: (() => void) | undefined;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const initials = `${parent.firstNameEn[0] ?? ''}${parent.lastNameEn[0] ?? ''}`.toUpperCase();
  const [students, setStudents] = useState<ParentStudent[] | null>(null);

  useEffect(() => {
    let active = true;
    financeApi
      .parentStudents(parent.id)
      .then((list) => {
        if (active) setStudents(list);
      })
      .catch(() => {
        if (active) setStudents([]);
      });
    return () => {
      active = false;
    };
  }, [parent.id]);

  const money = (v: string | null) => (v == null ? '—' : `${Number(v).toFixed(3)} JOD`);

  function openStudent(id: string) {
    onClose();
    router.push(`/people/students/${id}`);
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="fixed inset-0 bg-foreground/40" aria-hidden="true" />
      <div
        className="relative my-8 w-full max-w-2xl space-y-4 rounded-xl border border-border bg-card p-5 shadow-card"
        role="dialog"
        aria-modal="true"
        aria-label={t('people.parentProfile')}
      >
        <RecordHeader
          initials={initials}
          title={`${parent.firstNameEn} ${parent.lastNameEn}`}
          subtitle={
            <span dir="rtl" className="text-muted-foreground">
              {parent.firstNameAr} {parent.lastNameAr}
            </span>
          }
          badges={parent.occupation ? <Badge tone="muted">{parent.occupation}</Badge> : null}
          actions={
            <>
              {onEdit ? (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  {t('people.edit')}
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" onClick={onClose} aria-label={t('common.cancel')}>
                ✕
              </Button>
            </>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>{t('people.parentProfile')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <Detail label={t('people.phone')} value={parent.phone} mono />
            <Detail label={t('people.nationalId')} value={parent.nationalId} mono />
            <Detail label={t('people.occupation')} value={parent.occupation} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('people.children')}</CardTitle>
          </CardHeader>
          <CardContent>
            {students === null ? (
              <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                <Spinner /> {t('common.loading')}
              </div>
            ) : students.length === 0 ? (
              <EmptyState title={t('people.noStudents')} />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>{t('common.name')}</TH>
                    <TH>{t('structure.grade')}</TH>
                    <TH>{t('people.transport')}</TH>
                    <TH className="text-end">{t('finance.outstanding')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {students.map((s) => (
                    <TR key={s.studentId}>
                      <TD>
                        <button
                          type="button"
                          className="text-start font-medium text-foreground hover:text-primary-strong hover:underline"
                          onClick={() => openStudent(s.studentId)}
                        >
                          {s.firstNameEn} {s.lastNameEn}
                        </button>
                        {contextStudent?.id === s.studentId ? (
                          <Badge tone="muted" className="ms-2">
                            {t('people.primary')}
                          </Badge>
                        ) : null}
                      </TD>
                      <TD>{s.gradeNameEn ?? '—'}</TD>
                      <TD>
                        <Badge tone={s.transportRequested ? 'success' : 'muted'}>
                          {s.transportRequested ? t('common.yes') : t('common.no')}
                        </Badge>
                      </TD>
                      <TD
                        className={`text-end font-mono ${
                          Number(s.outstanding) > 0 ? 'text-accent-warm' : ''
                        }`}
                      >
                        {money(s.outstanding)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
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
