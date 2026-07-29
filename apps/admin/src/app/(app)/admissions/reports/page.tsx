'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Select,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  useToast,
} from '@axa/platform';
import { FeeModifiedBadge } from '@/components/fee-modified-badge';
import { admissionsApi, type EnrollmentRow, type FeeModificationRow } from '@/lib/admissions';
import { schoolsApi, campusesApi, gradesApi, academicYearsApi } from '@/lib/structure';
import type { AcademicYear, Campus, Grade } from '@/lib/structure';

type ReportTab = 'enrollments' | 'modifications';

/**
 * Admissions reports: registrations & re-enrollments (filterable by year/grade/status) and fee
 * modifications. Read-only; reuses the admissions endpoints. Requires enrollment:manage / finance:read.
 */
export default function AdmissionsReportsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<ReportTab>('enrollments');

  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusId, setCampusId] = useState('');
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [academicYearId, setAcademicYearId] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [status, setStatus] = useState('');

  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [mods, setMods] = useState<FeeModificationRow[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    byStatus: Record<string, number>;
    byAdmissionStatus: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const schools = await schoolsApi.list();
        const lists = await Promise.all(schools.map((s) => campusesApi.list(s.id).catch(() => [])));
        const flat = lists.flat();
        setCampuses(flat);
        if (flat[0]) setCampusId(flat[0].id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load campuses');
      }
    })();
  }, [toast]);

  useEffect(() => {
    if (!campusId) return;
    void Promise.all([academicYearsApi.list(campusId), gradesApi.list(campusId)])
      .then(([y, g]) => {
        setYears(y);
        setGrades(g);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load structure'));
  }, [campusId, toast]);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'enrollments') {
        const [rows, summary] = await Promise.all([
          admissionsApi.listEnrollments({
            ...(academicYearId ? { academicYearId } : {}),
            ...(gradeId ? { gradeId } : {}),
            // The enrollments report filters by the admission workflow status (Decision 2).
            ...(status ? { admissionStatus: status } : {}),
          }),
          admissionsApi.enrollmentStats(academicYearId || undefined),
        ]);
        setEnrollments(rows);
        setStats(summary);
      } else {
        setMods(await admissionsApi.listModifications(status || undefined));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to run report');
    } finally {
      setLoading(false);
    }
  }, [tab, academicYearId, gradeId, status, toast]);

  useEffect(() => {
    void run();
  }, [run]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-semibold">Admissions reports</h1>
        <p className="text-sm text-muted-foreground">
          Registrations, re-enrollments and fee modifications.
        </p>
      </header>

      <div className="flex gap-2">
        <Button
          variant={tab === 'enrollments' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('enrollments')}
        >
          Registrations & re-enrollments
        </Button>
        <Button
          variant={tab === 'modifications' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('modifications')}
        >
          Fee modifications
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-4">
          <Field label="Campus">
            <Select value={campusId} onChange={(e) => setCampusId(e.target.value)}>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameEn}
                </option>
              ))}
            </Select>
          </Field>
          {tab === 'enrollments' ? (
            <>
              <Field label="Academic year">
                <Select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}>
                  <option value="">All</option>
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Grade">
                <Select value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
                  <option value="">All</option>
                  {grades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nameEn}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">All</option>
                  <option value="REGISTERED">Registered</option>
                  <option value="ACCEPTED">Accepted (pending approval)</option>
                  <option value="QUOTED">Quoted</option>
                  <option value="CANCELLED">Cancelled</option>
                </Select>
              </Field>
            </>
          ) : (
            <Field label="Approval status">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </Select>
            </Field>
          )}
        </CardContent>
      </Card>

      {tab === 'enrollments' && stats ? (
        <Card>
          <CardHeader>
            <CardTitle>Enrollment summary{academicYearId ? '' : ' (all years)'}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <Stat label="Total" value={stats.total} />
            <Stat label="Active" value={stats.byStatus.ACTIVE ?? 0} />
            <Stat label="Promoted" value={stats.byStatus.PROMOTED ?? 0} />
            <Stat label="Repeated" value={stats.byStatus.REPEATED ?? 0} />
            <Stat label="Graduated" value={stats.byStatus.GRADUATED ?? 0} />
            <Stat label="Withdrawn" value={stats.byStatus.WITHDRAWN ?? 0} />
            <Stat label="Registered" value={stats.byAdmissionStatus.REGISTERED ?? 0} />
            <Stat label="Pending" value={stats.byAdmissionStatus.ACCEPTED ?? 0} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{tab === 'enrollments' ? 'Enrollments' : 'Fee modifications'}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : tab === 'enrollments' ? (
            enrollments.length === 0 ? (
              <EmptyState title="No enrollments" />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Student</TH>
                    <TH>Grade</TH>
                    <TH>Year</TH>
                    <TH>Transport</TH>
                    <TH>Payment</TH>
                    <TH>Status</TH>
                    <TH>Flag</TH>
                  </TR>
                </THead>
                <TBody>
                  {enrollments.map((e) => (
                    <TR key={e.id}>
                      <TD>
                        {e.student.firstNameEn} {e.student.lastNameEn}
                      </TD>
                      <TD>{e.grade.nameEn}</TD>
                      <TD>{e.academicYear.name}</TD>
                      <TD className="text-xs">{e.transportDirection.replace('_', ' ')}</TD>
                      <TD className="text-xs">{e.paymentMode}</TD>
                      <TD>
                        <Badge tone={e.admissionStatus === 'ACCEPTED' ? 'warning' : 'muted'}>
                          {e.admissionStatus.toLowerCase().replace('_', ' ')}
                        </Badge>
                      </TD>
                      <TD>
                        <FeeModifiedBadge feeModified={e.feeModified} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )
          ) : mods.length === 0 ? (
            <EmptyState title="No fee modifications" />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Student</TH>
                  <TH>Fee</TH>
                  <TH className="text-end">Original</TH>
                  <TH className="text-end">New</TH>
                  <TH className="text-end">Diff</TH>
                  <TH>Reason</TH>
                  <TH>Approval</TH>
                </TR>
              </THead>
              <TBody>
                {mods.map((m) => (
                  <TR key={m.id}>
                    <TD>
                      {m.enrollment
                        ? `${m.enrollment.student.firstNameEn} ${m.enrollment.student.lastNameEn}`
                        : '—'}
                    </TD>
                    <TD className="text-xs uppercase">{m.field}</TD>
                    <TD className="text-end font-mono">{m.originalValue}</TD>
                    <TD className="text-end font-mono">{m.newValue}</TD>
                    <TD className="text-end font-mono">{m.difference}</TD>
                    <TD className="max-w-[14rem] truncate" title={m.reason}>
                      {m.reason}
                    </TD>
                    <TD className="text-xs">{m.approval?.status ?? '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[4.5rem]">
      <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
