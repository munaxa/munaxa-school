'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import { useGridLabels } from '@/components/grid-labels';
import { useConfirm } from '@/components/confirm';
import { StatusBadge } from '@/components/status-badge';
import { teachersApi, teacherSubjects, type Teacher } from '@/lib/people';
import {
  Button,
  Card,
  CardContent,
  DataGrid,
  EmptyState,
  PageHeader,
  type ColumnDef,
} from '@munaxa/ui';

/**
 * The teaching staff of the school — a view of HR, not a second directory.
 *
 * Nobody is added here. A teacher is an employee first: HR creates the person and marks them as
 * teaching staff, choosing the subjects they instruct, and that is what puts them on this list.
 * Keeping one door in means a teacher always has a contract, a manager and a lifecycle behind
 * them, instead of a name that exists only in the timetable.
 */
export default function TeachersPage() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const labels = useGridLabels();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setTeachers(await teachersApi.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load teachers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    if (!(await confirm({ description: t('people.stopTeachingConfirm') }))) return;
    try {
      await teachersApi.remove(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  const columns = useMemo<ColumnDef<Teacher>[]>(
    () => [
      {
        id: 'name',
        header: t('common.name'),
        value: (tch) => `${tch.firstNameEn} ${tch.lastNameEn}`,
        sortable: true,
        rowHeader: true,
        cell: (tch) =>
          tch.employeeId ? (
            <Link
              href={`/people/employees/${tch.employeeId}`}
              className="font-medium text-foreground hover:text-primary-strong hover:underline"
            >
              {tch.firstNameEn} {tch.lastNameEn}
            </Link>
          ) : (
            <>
              {tch.firstNameEn} {tch.lastNameEn}
            </>
          ),
      },
      {
        id: 'nameAr',
        header: t('common.arabicName'),
        value: (tch) => `${tch.firstNameAr} ${tch.lastNameAr}`,
        sortable: true,
        cell: (tch) => (
          <span dir="rtl">
            {tch.firstNameAr} {tch.lastNameAr}
          </span>
        ),
      },
      {
        id: 'employeeNumber',
        header: t('people.employeeNumber'),
        value: (tch) => tch.employeeNumber ?? '',
        sortable: true,
        cell: (tch) => (
          <span className="font-mono text-xs text-muted-foreground">
            {tch.employeeNumber || '—'}
          </span>
        ),
      },
      {
        id: 'subjects',
        header: t('people.subjectsTaught'),
        value: (tch) =>
          teacherSubjects(tch)
            .map((s) => s.nameEn)
            .join(', '),
        cell: (tch) => {
          const subjects = teacherSubjects(tch);
          if (subjects.length === 0) {
            return <span className="text-xs text-muted-foreground">{t('people.noSubjects')}</span>;
          }
          return (
            <span className="flex flex-wrap gap-1">
              {subjects.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
                  style={{ background: `${s.colorHex}22` }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: s.colorHex }} />
                  {s.nameEn}
                </span>
              ))}
            </span>
          );
        },
      },
      {
        id: 'specialization',
        header: t('people.specialization'),
        value: (tch) => tch.specialization ?? '',
        sortable: true,
        cell: (tch) => tch.specialization || '—',
      },
      {
        id: 'status',
        header: t('common.status'),
        value: (tch) => tch.status,
        sortable: true,
        cell: (tch) => <StatusBadge status={tch.status} />,
      },
    ],
    [t],
  );

  if (loading) {
    return (
      <Shell>
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title={t('nav.teachers')}
          description={t('people.teachersSubtitle')}
          actions={
            <Link
              href="/people/employees"
              className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary/60"
            >
              {t('people.addTeacherInHr')}
            </Link>
          }
        />
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            {t('people.teacherFromHrHint')}
          </CardContent>
        </Card>

        <DataGrid
          rows={teachers}
          columns={columns}
          getRowId={(tch) => tch.id}
          getRowLabel={(tch) => `${tch.firstNameEn} ${tch.lastNameEn}`}
          labels={labels}
          aria-label={t('nav.teachers')}
          emptyState={<EmptyState title={t('people.noTeachers')} />}
          rowActions={(tch) => (
            <Button variant="ghost" size="sm" onClick={() => void remove(tch.id)}>
              {t('people.stopTeaching')}
            </Button>
          )}
        />
      </div>
    </Shell>
  );
}
