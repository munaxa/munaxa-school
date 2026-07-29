'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useI18n } from '@/components/i18n-provider';
import { usePrincipal } from '@/components/shell';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from '@axa/platform';
import { RecordHeader } from '@/components/domain';
import { employmentStatusLabel } from '@/components/status-badge';
import {
  departmentsApi,
  employeesApi,
  positionsApi,
  EMPLOYEE_STATUS_TRANSITIONS,
  type Department,
  type Employee,
  type Position,
} from '@/lib/people';
import { EmployeeEditor } from '../employee-editor';
import { ContractsTab } from './tabs/contracts-tab';
import { DocumentsTab } from './tabs/documents-tab';
import { DriverTab } from './tabs/driver-tab';
import { LeaveTab } from './tabs/leave-tab';
import { AttendanceTab } from './tabs/attendance-tab';
import { PerformanceTab } from './tabs/performance-tab';
import { TrainingTab } from './tabs/training-tab';
import { AssetsTab } from './tabs/assets-tab';
import {
  BankAccountsCard,
  CertificatesCard,
  DependentsCard,
  EducationCard,
  EmergencyContactsCard,
} from './tabs/personal-records-tabs';

const STATUS_TONE = {
  ACTIVE: 'success',
  HIRED: 'success',
  PROMOTION: 'success',
  PROBATION: 'warning',
  ON_LEAVE: 'warning',
  SUSPENDED: 'warning',
  TERMINATED: 'danger',
} as const;

export function EmployeeProfile() {
  const { t } = useI18n();
  const toast = useToast();
  const principal = usePrincipal();
  const params = useParams<{ employeeId: string }>();
  const employeeId = params.employeeId;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState('overview');

  const held = useMemo(() => new Set(principal.permissions), [principal.permissions]);
  const can = useCallback(
    (perm: string) => held.has(perm) || principal.isPlatform,
    [held, principal.isPlatform],
  );
  const canManage = can('employee:manage');
  const canLifecycle = can('hr:lifecycle:manage');
  const canSensitive = can('hr:sensitive:read');
  const canOrg = can('hr:org:read');
  const canContractRead = can('hr:contract:read');
  const canContractManage = can('hr:contract:manage');
  const canDocumentRead = can('hr:document:read');
  const canDocumentManage = can('hr:document:manage');
  const canDriverRead = can('driver:read');
  const canDriverManage = can('driver:manage');
  const canLeaveRead = can('staff-leave:read');
  const canLeaveRequest = can('staff-leave:request');
  const canLeaveApprove = can('staff-leave:approve');
  const canAttendanceRead = can('staff-attendance:read');
  const canAttendanceManage = can('staff-attendance:manage');
  const canPerformanceRead = can('performance:read');
  const canPerformanceManage = can('performance:manage');
  const canTrainingRead = can('training:read');
  const canTrainingManage = can('training:manage');
  const canAssetRead = can('asset:read');
  const canAssetManage = can('asset:manage');

  const load = useCallback(async () => {
    try {
      const emp = await employeesApi.get(employeeId);
      setEmployee(emp);
      if (canManage || canOrg) {
        const [deps, pos, staff] = await Promise.all([
          departmentsApi.list().catch(() => [] as Department[]),
          positionsApi.list().catch(() => [] as Position[]),
          employeesApi.list().catch(() => [] as Employee[]),
        ]);
        setDepartments(deps);
        setPositions(pos);
        setManagers(staff);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load employee');
    } finally {
      setLoading(false);
    }
  }, [employeeId, canManage, canOrg]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }
  if (error || !employee) {
    return <p className="text-sm text-destructive">{error ?? t('common.error')}</p>;
  }

  const e = employee;
  const initials = `${e.firstNameEn[0] ?? ''}${e.lastNameEn[0] ?? ''}`.toUpperCase();
  const tone = STATUS_TONE[e.status as keyof typeof STATUS_TONE] ?? 'default';

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link
        href="/people/employees"
        className="text-sm text-muted-foreground hover:text-primary-strong"
      >
        ← {t('nav.hr')}
      </Link>

      <RecordHeader
        initials={initials}
        title={`${e.firstNameEn} ${e.lastNameEn}`}
        subtitle={
          <span dir="rtl" className="text-muted-foreground">
            {e.firstNameAr} {e.lastNameAr}
          </span>
        }
        status={{ label: employmentStatusLabel(e.status), tone }}
        badges={
          <>
            <Badge tone="muted">{e.jobTitle}</Badge>
            {e.department ? <Badge tone="muted">{e.department.name}</Badge> : null}
            {e.teacher ? <Badge tone="default">{t('people.typeTeacher')}</Badge> : null}
          </>
        }
        actions={
          canManage ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              {t('common.edit')}
            </Button>
          ) : null
        }
      />

      {canLifecycle ? <StatusChanger employee={e} onChanged={setEmployee} /> : null}

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t('hr.tabOverview')}</TabsTrigger>
          <TabsTrigger value="personal">{t('hr.tabPersonal')}</TabsTrigger>
          <TabsTrigger value="employment">{t('hr.tabEmployment')}</TabsTrigger>
          <TabsTrigger value="org">{t('hr.tabOrg')}</TabsTrigger>
          {canContractRead ? (
            <TabsTrigger value="contracts">{t('hr.contracts')}</TabsTrigger>
          ) : null}
          {canDocumentRead ? (
            <TabsTrigger value="documents">{t('hr.documents')}</TabsTrigger>
          ) : null}
          <TabsTrigger value="family">{t('hr.tabFamily')}</TabsTrigger>
          <TabsTrigger value="qualifications">{t('hr.tabQualifications')}</TabsTrigger>
          {canSensitive ? <TabsTrigger value="bank">{t('hr.tabBank')}</TabsTrigger> : null}
          {canDriverRead ? <TabsTrigger value="driver">{t('hr.tabDriver')}</TabsTrigger> : null}
          {canLeaveRead ? <TabsTrigger value="leave">{t('hr.tabLeave')}</TabsTrigger> : null}
          {canAttendanceRead ? (
            <TabsTrigger value="attendance">{t('hr.tabAttendance')}</TabsTrigger>
          ) : null}
          {canPerformanceRead ? (
            <TabsTrigger value="performance">{t('hr.tabPerformance')}</TabsTrigger>
          ) : null}
          {canTrainingRead ? (
            <TabsTrigger value="training">{t('hr.tabTraining')}</TabsTrigger>
          ) : null}
          {canAssetRead ? <TabsTrigger value="assets">{t('hr.tabAssets')}</TabsTrigger> : null}
          <TabsTrigger value="history">{t('hr.tabHistory')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <DetailCard title={t('hr.tabOverview')}>
            <Detail label={t('people.employeeNumber')} value={e.employeeNumber} />
            <Detail label={t('people.jobTitle')} value={e.jobTitle} />
            <Detail
              label={t('hr.employmentType')}
              value={e.employmentType ? t(`hr.type.${e.employmentType}`) : null}
            />
            <Detail label={t('common.status')} value={employmentStatusLabel(e.status)} />
            <Detail label={t('people.department')} value={e.department?.name} />
            <Detail label={t('hr.position')} value={e.position?.title} />
            <Detail
              label={t('hr.manager')}
              value={e.manager ? `${e.manager.firstNameEn} ${e.manager.lastNameEn}` : null}
            />
            <Detail label={t('hr.hireDate')} value={fmtDate(e.hireDate)} />
          </DetailCard>
        </TabsContent>

        <TabsContent value="personal">
          <DetailCard title={t('hr.tabPersonal')}>
            {!canSensitive ? (
              <p className="col-span-full text-sm text-muted-foreground">
                {t('hr.restrictedNote')}
              </p>
            ) : null}
            <Detail
              label={t('people.gender')}
              value={e.gender ? t(`people.${e.gender.toLowerCase()}`) : null}
            />
            <Detail label={t('hr.dob')} value={fmtDate(e.dateOfBirth)} />
            <Detail label={t('people.nationalId')} value={e.nationalId} />
            <Detail label={t('hr.passport')} value={e.passportNumber} />
            <Detail label={t('hr.nationality')} value={e.nationality} />
            <Detail
              label={t('hr.maritalStatus')}
              value={e.maritalStatus ? t(`hr.marital.${e.maritalStatus}`) : null}
            />
            <Detail label={t('hr.religion')} value={e.religion} />
            <Detail label={t('hr.personalEmail')} value={e.personalEmail} />
            <Detail label={t('hr.personalPhone')} value={e.personalPhone} />
            <Detail label={t('hr.visa')} value={e.visaNumber} />
            <Detail label={t('hr.visaExpiry')} value={fmtDate(e.visaExpiry)} />
          </DetailCard>
        </TabsContent>

        <TabsContent value="employment">
          <DetailCard title={t('hr.tabEmployment')}>
            <Detail
              label={t('hr.employmentType')}
              value={e.employmentType ? t(`hr.type.${e.employmentType}`) : null}
            />
            <Detail label={t('common.status')} value={employmentStatusLabel(e.status)} />
            <Detail label={t('hr.hireDate')} value={fmtDate(e.hireDate)} />
            <Detail label={t('hr.probationEnd')} value={fmtDate(e.probationEndDate)} />
            <Detail label={t('hr.terminationDate')} value={fmtDate(e.terminationDate)} />
            <Detail
              label={t('hr.workingHours')}
              value={e.workingHoursPerWeek != null ? String(e.workingHoursPerWeek) : null}
            />
          </DetailCard>
        </TabsContent>

        <TabsContent value="org">
          <DetailCard title={t('hr.orgPlacement')}>
            <Detail label={t('people.department')} value={e.department?.name} />
            <Detail label={t('hr.position')} value={e.position?.title} />
            <Detail
              label={t('hr.manager')}
              value={e.manager ? `${e.manager.firstNameEn} ${e.manager.lastNameEn}` : null}
            />
            <Detail label={t('hr.campus')} value={e.campus ? e.campus.nameEn : null} />
          </DetailCard>
        </TabsContent>

        {canContractRead ? (
          <TabsContent value="contracts">
            <ContractsTab employeeId={e.id} canManage={canContractManage} />
          </TabsContent>
        ) : null}

        {canDocumentRead ? (
          <TabsContent value="documents">
            <DocumentsTab employeeId={e.id} canManage={canDocumentManage} />
          </TabsContent>
        ) : null}

        <TabsContent value="family">
          <div className="space-y-4">
            <EmergencyContactsCard employeeId={e.id} canManage={canManage} />
            <DependentsCard employeeId={e.id} canManage={canManage} />
          </div>
        </TabsContent>

        <TabsContent value="qualifications">
          <div className="space-y-4">
            <EducationCard employeeId={e.id} canManage={canManage} />
            <CertificatesCard employeeId={e.id} canManage={canManage} />
          </div>
        </TabsContent>

        {canSensitive ? (
          <TabsContent value="bank">
            <BankAccountsCard employeeId={e.id} canManage={canManage} />
          </TabsContent>
        ) : null}

        {canDriverRead ? (
          <TabsContent value="driver">
            <DriverTab employeeId={e.id} canManage={canDriverManage} />
          </TabsContent>
        ) : null}

        {canLeaveRead ? (
          <TabsContent value="leave">
            <LeaveTab employeeId={e.id} canRequest={canLeaveRequest} canApprove={canLeaveApprove} />
          </TabsContent>
        ) : null}

        {canAttendanceRead ? (
          <TabsContent value="attendance">
            <AttendanceTab employeeId={e.id} canManage={canAttendanceManage} />
          </TabsContent>
        ) : null}

        {canPerformanceRead ? (
          <TabsContent value="performance">
            <PerformanceTab employeeId={e.id} canManage={canPerformanceManage} />
          </TabsContent>
        ) : null}

        {canTrainingRead ? (
          <TabsContent value="training">
            <TrainingTab employeeId={e.id} canManage={canTrainingManage} />
          </TabsContent>
        ) : null}

        {canAssetRead ? (
          <TabsContent value="assets">
            <AssetsTab employeeId={e.id} canManage={canAssetManage} />
          </TabsContent>
        ) : null}

        <TabsContent value="history">
          <StatusHistory employee={e} />
        </TabsContent>
      </Tabs>

      {editing ? (
        <EmployeeEditor
          employee={e}
          departments={departments}
          positions={positions}
          managers={managers}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEmployee(saved);
            setEditing(false);
            toast.success(t('hr.employeeSaved'));
          }}
        />
      ) : null}
    </div>
  );
}

/** Inline lifecycle transition control (visible only with hr:lifecycle:manage). */
function StatusChanger({
  employee,
  onChanged,
}: {
  employee: Employee;
  onChanged: (e: Employee) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const next = EMPLOYEE_STATUS_TRANSITIONS[employee.status] ?? [];
  const [toStatus, setToStatus] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (next.length === 0) {
    return (
      <Card>
        <CardContent className="py-3 text-sm text-muted-foreground">
          {t('hr.terminalStatus')}
        </CardContent>
      </Card>
    );
  }

  async function apply() {
    if (!toStatus) return;
    setBusy(true);
    try {
      const updated = await employeesApi.transitionStatus(employee.id, {
        toStatus: toStatus as Employee['status'],
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      onChanged(updated);
      setToStatus('');
      setReason('');
      toast.success(t('hr.statusChanged'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Transition failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('hr.changeStatus')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('hr.newStatus')} className="min-w-44">
            <Select value={toStatus} onChange={(e) => setToStatus(e.target.value)}>
              <option value="">—</option>
              {next.map((s) => (
                <option key={s} value={s}>
                  {employmentStatusLabel(s)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('common.reason')} className="flex-1 min-w-48">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('common.optional')}
            />
          </Field>
          <Button onClick={() => void apply()} disabled={busy || !toStatus}>
            {busy ? t('common.saving') : t('hr.apply')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusHistory({ employee }: { employee: Employee }) {
  const { t } = useI18n();
  const rows = employee.statusHistory ?? [];
  return (
    <DetailCard title={t('hr.tabHistory')}>
      {rows.length === 0 ? (
        <p className="col-span-full text-sm text-muted-foreground">{t('hr.noHistory')}</p>
      ) : (
        <ol className="col-span-full space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="flex gap-3 border-b border-border pb-3 last:border-0">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div className="text-sm">
                <div className="font-medium">
                  {row.fromStatus ? `${employmentStatusLabel(row.fromStatus)} → ` : ''}
                  {employmentStatusLabel(row.toStatus)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {fmtDateTime(row.createdAt)}
                  {row.actor
                    ? ` · ${row.actor.firstNameEn ?? ''} ${row.actor.lastNameEn ?? ''}`.trimEnd()
                    : ''}
                </div>
                {row.reason ? <div className="mt-0.5 text-xs">{row.reason}</div> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </DetailCard>
  );
}

function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">
        {value ? value : <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

function fmtDate(v?: string | null): string | null {
  if (!v) return null;
  return v.slice(0, 10);
}
function fmtDateTime(v?: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
}
