'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import { useConfirm } from '@/components/confirm';
import { usePrincipal } from '@/components/shell';
import { StatusBadge } from '@/components/status-badge';
import {
  departmentsApi,
  employeesApi,
  positionsApi,
  teachersApi,
  EMPLOYEE_STATUSES,
  type Department,
  type Employee,
  type Position,
  type Teacher,
} from '@/lib/people';
import {
  Button,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from '@axa/platform';
import { EmployeeEditor } from './employee-editor';
import { TeacherProfileDialog } from '../teachers/teacher-profile-dialog';

type StaffRow =
  | { kind: 'employee'; id: string; employee: Employee }
  | { kind: 'teacher'; id: string; teacher: Teacher };

export default function EmployeesPage() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const principal = usePrincipal();
  const canManage = principal.permissions.includes('employee:manage') || principal.isPlatform;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'teacher' | 'employee'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewingTeacher, setViewingTeacher] = useState<Teacher | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      // Teachers and general employees are stored separately, but staff want to see them in one
      // directory — merge both here. Teachers stay managed (assignments) on the Teachers tab.
      const [emps, tchs, deps, pos] = await Promise.all([
        employeesApi.list({ includeInactive: true }),
        teachersApi.list().catch(() => [] as Teacher[]),
        departmentsApi.list().catch(() => [] as Department[]),
        positionsApi.list().catch(() => [] as Position[]),
      ]);
      setEmployees(emps);
      setTeachers(tchs);
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

  const rows = useMemo<StaffRow[]>(() => {
    const all: StaffRow[] = [
      ...teachers.map((teacher) => ({ kind: 'teacher' as const, id: teacher.id, teacher })),
      ...employees.map((employee) => ({ kind: 'employee' as const, id: employee.id, employee })),
    ];
    const q = query.trim().toLowerCase();
    return all.filter((r) => {
      if (typeFilter !== 'all' && r.kind !== typeFilter) return false;
      const status = r.kind === 'teacher' ? r.teacher.status : r.employee.status;
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (!q) return true;
      const p = r.kind === 'teacher' ? r.teacher : r.employee;
      const role = r.kind === 'teacher' ? (r.teacher.specialization ?? '') : r.employee.jobTitle;
      return (
        `${p.firstNameEn} ${p.lastNameEn}`.toLowerCase().includes(q) ||
        `${p.firstNameAr} ${p.lastNameAr}`.includes(query) ||
        role.toLowerCase().includes(q)
      );
    });
  }, [teachers, employees, query, typeFilter, statusFilter]);

  const activeCount =
    employees.filter((e) => e.status === 'ACTIVE').length +
    teachers.filter((tc) => tc.status === 'ACTIVE').length;

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
          <Kpi label={t('people.kpiStaff')} value={employees.length + teachers.length} />
          <Kpi label={t('people.kpiTeachers')} value={teachers.length} />
          <Kpi label={t('people.kpiEmployees')} value={employees.length} />
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

        <Table>
          <THead>
            <TR>
              <TH>{t('common.name')}</TH>
              <TH>{t('common.arabicName')}</TH>
              <TH>{t('people.type')}</TH>
              <TH>{t('people.role')}</TH>
              <TH>{t('common.status')}</TH>
              <TH className="text-end">{t('common.actions')}</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) =>
              r.kind === 'teacher' ? (
                <TR key={`t-${r.id}`}>
                  <TD>
                    <button
                      type="button"
                      className="text-start font-medium text-foreground hover:text-primary-strong hover:underline"
                      onClick={() => setViewingTeacher(r.teacher)}
                    >
                      {r.teacher.firstNameEn} {r.teacher.lastNameEn}
                    </button>
                  </TD>
                  <TD dir="rtl">
                    {r.teacher.firstNameAr} {r.teacher.lastNameAr}
                  </TD>
                  <TD>{t('people.typeTeacher')}</TD>
                  <TD>{r.teacher.specialization || '—'}</TD>
                  <TD>
                    <StatusBadge status={r.teacher.status} />
                  </TD>
                  <TD className="text-end text-xs text-muted-foreground">
                    {t('people.teachersTab')}
                  </TD>
                </TR>
              ) : (
                <TR key={`e-${r.id}`}>
                  <TD>
                    <Link
                      href={`/people/employees/${r.employee.id}`}
                      className="font-medium text-foreground hover:text-primary-strong hover:underline"
                    >
                      {r.employee.firstNameEn} {r.employee.lastNameEn}
                    </Link>
                  </TD>
                  <TD dir="rtl">
                    {r.employee.firstNameAr} {r.employee.lastNameAr}
                  </TD>
                  <TD>{t('people.typeStaff')}</TD>
                  <TD>
                    {r.employee.jobTitle}
                    {r.employee.department ? (
                      <span className="text-muted-foreground"> · {r.employee.department.name}</span>
                    ) : null}
                  </TD>
                  <TD>
                    <StatusBadge status={r.employee.status} />
                  </TD>
                  <TD className="text-end">
                    <Link
                      href={`/people/employees/${r.employee.id}`}
                      className="text-sm text-primary-strong hover:underline"
                    >
                      {t('people.view')}
                    </Link>
                    {canManage ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => void remove(r.employee.id)}
                      >
                        {t('common.delete')}
                      </Button>
                    ) : null}
                  </TD>
                </TR>
              ),
            )}
            {rows.length === 0 ? (
              <TR>
                <TD colSpan={6}>
                  <EmptyState title={t('people.noStaff')} />
                </TD>
              </TR>
            ) : null}
          </TBody>
        </Table>
        <p className="text-xs text-muted-foreground">{t('people.addTeacherHint')}</p>
      </div>

      {viewingTeacher ? (
        <TeacherProfileDialog teacher={viewingTeacher} onClose={() => setViewingTeacher(null)} />
      ) : null}

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
