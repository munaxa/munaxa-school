'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import { useGridLabels } from '@/components/grid-labels';
import { useConfirm } from '@/components/confirm';
import { usePrincipal } from '@/components/shell';
import { StatusBadge } from '@/components/status-badge';
import {
  departmentsApi,
  employeesApi,
  positionsApi,
  EMPLOYEE_STATUSES,
  type Department,
  type Employee,
  type Position,
} from '@/lib/people';
import {
  Button,
  DataGrid,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  type ColumnDef,
} from '@munaxa/ui';
import { EmployeeEditor } from './employee-editor';

/** The row's Latin name — what it sorts by, and what its selection checkbox is called. */
function personName(employee: Employee): string {
  return `${employee.firstNameEn} ${employee.lastNameEn}`;
}

export default function EmployeesPage() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const labels = useGridLabels();
  const principal = usePrincipal();
  const canManage = principal.permissions.includes('employee:manage') || principal.isPlatform;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'teacher' | 'employee'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      // One row per person. Everyone the school employs is an Employee — teaching is a facet on
      // that same record, so the directory reads it from there rather than merging a second list.
      const [emps, deps, pos] = await Promise.all([
        employeesApi.list({ includeInactive: true }),
        departmentsApi.list().catch(() => [] as Department[]),
        positionsApi.list().catch(() => [] as Position[]),
      ]);
      setEmployees(emps);
      setDepartments(deps);
      setPositions(pos);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    if (!(await confirm())) return;
    try {
      await employeesApi.remove(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  const teachingCount = employees.filter((e) => e.teacher).length;

  const rows = useMemo<Employee[]>(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      if (typeFilter === 'teacher' && !e.teacher) return false;
      if (typeFilter === 'employee' && e.teacher) return false;
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (!q) return true;
      return (
        `${e.firstNameEn} ${e.lastNameEn}`.toLowerCase().includes(q) ||
        `${e.firstNameAr} ${e.lastNameAr}`.includes(query) ||
        e.jobTitle.toLowerCase().includes(q) ||
        (e.teacher?.specialization ?? '').toLowerCase().includes(q) ||
        (e.employeeNumber ?? '').toLowerCase().includes(q)
      );
    });
  }, [employees, query, typeFilter, statusFilter]);

  const columns = useMemo<ColumnDef<Employee>[]>(
    () => [
      {
        id: 'name',
        header: t('common.name'),
        value: personName,
        sortable: true,
        rowHeader: true,
        cell: (e) => (
          <Link
            href={`/people/employees/${e.id}`}
            className="font-medium text-foreground hover:text-primary-strong hover:underline"
          >
            {e.firstNameEn} {e.lastNameEn}
          </Link>
        ),
      },
      {
        id: 'nameAr',
        header: t('common.arabicName'),
        value: (e) => `${e.firstNameAr} ${e.lastNameAr}`,
        sortable: true,
        cell: (e) => (
          <span dir="rtl">
            {e.firstNameAr} {e.lastNameAr}
          </span>
        ),
      },
      {
        id: 'employeeNumber',
        header: t('people.employeeNumber'),
        value: (e) => e.employeeNumber ?? '',
        sortable: true,
        cell: (e) => (
          <span className="font-mono text-xs text-muted-foreground">{e.employeeNumber || '—'}</span>
        ),
      },
      {
        id: 'type',
        header: t('people.type'),
        value: (e) => (e.teacher ? t('people.typeTeacher') : t('people.typeStaff')),
        sortable: true,
      },
      {
        id: 'role',
        header: t('people.role'),
        value: (e) => e.jobTitle,
        sortable: true,
        cell: (e) => (
          <>
            {e.jobTitle}
            {e.department ? (
              <span className="text-muted-foreground"> · {e.department.name}</span>
            ) : null}
          </>
        ),
      },
      {
        id: 'status',
        header: t('common.status'),
        value: (e) => e.status,
        sortable: true,
        cell: (e) => <StatusBadge status={e.status} />,
      },
    ],
    [t],
  );

  const activeCount = employees.filter((e) => e.status === 'ACTIVE').length;

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
          title={t('nav.hr')}
          align="center"
          actions={
            <div className="flex gap-2">
              <Link
                href="/people/org"
                className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary/60"
              >
                {t('hr.organization')}
              </Link>
              {canManage ? (
                <Button onClick={() => setCreating(true)}>{t('people.addEmployee')}</Button>
              ) : null}
            </div>
          }
        />
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {/* KPIs */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label={t('people.kpiStaff')} value={employees.length} />
          <Kpi label={t('people.kpiTeachers')} value={teachingCount} />
          <Kpi label={t('people.kpiEmployees')} value={employees.length - teachingCount} />
          <Kpi label={t('people.kpiActive')} value={activeCount} tone="text-accent-cool" />
        </section>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t('common.search')} className="flex-1">
            <Input
              value={query}
              placeholder={t('people.searchStaffPlaceholder')}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
          <Field label={t('people.type')}>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            >
              <option value="all">{t('common.all')}</option>
              <option value="teacher">{t('people.typeTeacher')}</option>
              <option value="employee">{t('people.typeStaff')}</option>
            </Select>
          </Field>
          <Field label={t('common.status')}>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">{t('common.all')}</option>
              {EMPLOYEE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`hr.status.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {/*
          The three filter controls above stay School's: type and status are domain vocabulary, and
          the free-text box searches the Arabic name without folding accents, which the grid's own
          search does. So `searchable` is off and the grid renders the rows School selected.
        */}
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(e) => e.id}
          getRowLabel={(e) => personName(e)}
          labels={labels}
          searchable={false}
          rowActionsWidth={canManage ? 132 : 88}
          aria-label={t('nav.hr')}
          emptyState={<EmptyState title={t('people.noStaff')} />}
          rowActions={(e) => (
            <span className="flex items-center justify-end gap-1">
              <Link
                href={`/people/employees/${e.id}`}
                className="text-sm text-primary-strong hover:underline"
              >
                {t('people.view')}
              </Link>
              {canManage ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => void remove(e.id)}
                >
                  {t('common.delete')}
                </Button>
              ) : null}
            </span>
          )}
        />
        <p className="text-xs text-muted-foreground">{t('people.addTeacherHint')}</p>
      </div>

      {creating ? (
        <EmployeeEditor
          departments={departments}
          positions={positions}
          managers={employees}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void load();
          }}
        />
      ) : null}
    </Shell>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`font-display text-xl font-semibold ${tone ?? ''}`}>{value}</div>
    </div>
  );
}
