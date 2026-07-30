'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Shell } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DatePicker,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Progress,
  ReadinessRing,
  Select,
  Spinner,
  StatCard,
  Stepper,
  useToast,
  type Tone,
} from '@axa/platform';
import {
  academicYearsApi,
  campusesApi,
  schoolsApi,
  semestersApi,
  type AcademicYear,
  type AcademicYearOverview,
  type AcademicYearReadiness,
  type AcademicYearStatus,
  type Campus,
  type School,
  type Semester,
} from '@/lib/structure';

// ─────────────────────────────────────────────────────────────── helpers

const STATUS_TONE: Record<AcademicYearStatus, Tone> = {
  UPCOMING: 'warning',
  ACTIVE: 'success',
  CLOSED: 'muted',
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtMoney(v: string | number): string {
  return `${Number(v).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} JOD`;
}

// ─────────────────────────────────────────────────────────────── page

export default function AcademicYearWorkspacePage() {
  const { t } = useI18n();
  const toast = useToast();
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusId, setCampusId] = useState('');

  useEffect(() => {
    schoolsApi
      .list()
      .then(setSchools)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load schools'));
  }, [toast]);

  useEffect(() => {
    setCampusId('');
    setCampuses([]);
    if (!schoolId) return;
    campusesApi
      .list(schoolId)
      .then((cs) => {
        setCampuses(cs);
        // Default to the main campus so the workspace is one selection away.
        const main = cs.find((c) => c.isMain) ?? cs[0];
        if (main) setCampusId(main.id);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load campuses'));
  }, [schoolId, toast]);

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title={t('academicYear.title')} description={t('academicYear.subtitle')} />

        <Card>
          <CardContent className="grid gap-3 pt-6 sm:grid-cols-2">
            <Field label={t('structure.school')}>
              <Select value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
                <option value="">{t('structure.selectSchool')}</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nameEn}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('structure.campus')}>
              <Select
                value={campusId}
                onChange={(e) => setCampusId(e.target.value)}
                disabled={!schoolId}
              >
                <option value="">{t('structure.selectCampus')}</option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameEn}
                  </option>
                ))}
              </Select>
            </Field>
          </CardContent>
        </Card>

        {campusId ? (
          <Workspace campusId={campusId} />
        ) : (
          <p className="text-sm text-muted-foreground">{t('academicYear.selectHint')}</p>
        )}
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────── workspace

function Workspace({ campusId }: { campusId: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [years, setYears] = useState<AcademicYear[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    academicYearsApi
      .list(campusId)
      .then(setYears)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load academic years'));
  }, [campusId, toast]);

  useEffect(() => {
    setYears(null);
    load();
  }, [load]);

  // ACTIVE first, then UPCOMING (planned), then CLOSED — the operational reading order.
  const ordered = useMemo(() => {
    if (!years) return [];
    const rank: Record<AcademicYearStatus, number> = { ACTIVE: 0, UPCOMING: 1, CLOSED: 2 };
    return [...years].sort(
      (a, b) => rank[a.status] - rank[b.status] || b.startDate.localeCompare(a.startDate),
    );
  }, [years]);

  if (years === null) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('academicYear.count').replace('{n}', String(years.length))}
        </p>
        <Button onClick={() => setShowCreate(true)}>{t('academicYear.addYear')}</Button>
      </div>

      {ordered.length === 0 ? (
        <EmptyState title={t('structure.noYears')} />
      ) : (
        ordered.map((year) => (
          <AcademicYearCard key={year.id} year={year} onChanged={load} campusId={campusId} />
        ))
      )}

      <CreateYearDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        campusId={campusId}
        onCreated={() => {
          setShowCreate(false);
          load();
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── card

function AcademicYearCard({
  year,
  campusId,
  onChanged,
}: {
  year: AcademicYear;
  campusId: string;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [overview, setOverview] = useState<AcademicYearOverview | null>(null);
  const [readiness, setReadiness] = useState<AcademicYearReadiness | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showSetCurrent, setShowSetCurrent] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [deletable, setDeletable] = useState<boolean | null>(null);

  useEffect(() => {
    academicYearsApi
      .overview(year.id)
      .then(setOverview)
      .catch(() => setOverview(null));
    academicYearsApi
      .readiness(year.id)
      .then(setReadiness)
      .catch(() => setReadiness(null));
    if (year.status === 'UPCOMING') {
      academicYearsApi
        .deletable(year.id)
        .then((d) => setDeletable(d.deletable))
        .catch(() => setDeletable(false));
    }
  }, [year.id, year.status]);

  const statusLabel = t(`academicYear.status.${year.status}`);

  async function onDelete() {
    try {
      await academicYearsApi.remove(year.id);
      toast.success(t('academicYear.deleted'));
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {readiness ? (
              <ReadinessRing value={readiness.score} caption={t('academicYear.ready')} />
            ) : (
              <div className="h-[72px] w-[72px]" />
            )}
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                {year.name}
                <Badge tone={STATUS_TONE[year.status]}>{statusLabel}</Badge>
              </CardTitle>
              {year.isCurrent ? (
                <p className="text-xs font-medium text-accent-cool">
                  {t('academicYear.currentMarker')}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {fmtDate(year.startDate)} → {fmtDate(year.endDate)}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('academicYear.registrationWindow')}:{' '}
                {year.registrationStartDate && year.registrationEndDate ? (
                  <span>
                    {fmtDate(year.registrationStartDate)} → {fmtDate(year.registrationEndDate)}
                  </span>
                ) : (
                  <span className="text-accent-warm">{t('academicYear.registrationNotSet')}</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <YearActions
              year={year}
              deletable={deletable}
              onEdit={() => setShowEdit(true)}
              onSetCurrent={() => setShowSetCurrent(true)}
              onClose={() => setShowClose(true)}
              onDelete={() => void onDelete()}
              onToggleTerms={() => setExpanded((v) => !v)}
              expanded={expanded}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Core KPI strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label={t('academicYear.kpi.students')} value={overview?.studentCount ?? '—'} />
          <StatCard
            label={t('academicYear.kpi.enrollments')}
            value={overview?.activeEnrollments ?? '—'}
          />
          <StatCard label={t('academicYear.kpi.classes')} value={overview?.classCount ?? '—'} />
          <StatCard
            label={t('academicYear.kpi.semesters')}
            value={overview?.semesterCount ?? '—'}
          />
        </div>

        {/* Operational metrics */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricBar
            label={t('academicYear.kpi.attendance')}
            pct={overview?.attendancePct ?? null}
          />
          <MetricBar
            label={t('academicYear.kpi.reportCards')}
            pct={overview?.reportCardCompletionPct ?? null}
          />
          <MetricBar
            label={t('academicYear.kpi.timetable')}
            pct={overview?.timetableCompletionPct ?? null}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          <StatCard
            label={t('academicYear.kpi.outstanding')}
            value={overview ? fmtMoney(overview.outstandingFees) : '—'}
            tone={overview && Number(overview.outstandingFees) > 0 ? 'warning' : 'default'}
          />
          <StatCard
            label={t('academicYear.kpi.unverified')}
            value={overview?.unverifiedPayments ?? '—'}
            tone={overview && overview.unverifiedPayments > 0 ? 'warning' : 'default'}
          />
        </div>

        {/* Activation validation — shown for planned years that are not yet ready. */}
        {year.status === 'UPCOMING' && readiness && !readiness.activation.canActivate ? (
          <ActivationValidation checks={readiness.activation.checks} />
        ) : null}

        {expanded ? (
          <Semesters academicYearId={year.id} readOnly={year.status === 'CLOSED'} />
        ) : null}
      </CardContent>

      <SetCurrentDialog
        open={showSetCurrent}
        year={year}
        readiness={readiness}
        onClose={() => setShowSetCurrent(false)}
        onDone={() => {
          setShowSetCurrent(false);
          onChanged();
        }}
      />
      <CloseWizard
        open={showClose}
        year={year}
        overview={overview}
        readiness={readiness}
        onClose={() => setShowClose(false)}
        onDone={() => {
          setShowClose(false);
          onChanged();
        }}
      />
      <EditYearDialog
        open={showEdit}
        year={year}
        onClose={() => setShowEdit(false)}
        onSaved={() => {
          setShowEdit(false);
          onChanged();
        }}
      />
      {/* campusId kept for future semester creation scoping */}
      <input type="hidden" value={campusId} readOnly />
    </Card>
  );
}

function MetricBar({ label, pct }: { label: string; pct: number | null }) {
  const { t } = useI18n();
  const tone: Tone =
    pct === null ? 'muted' : pct >= 90 ? 'success' : pct >= 50 ? 'default' : 'warning';
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card/60 p-4">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="tabular-nums font-semibold">
          {pct === null ? t('academicYear.noData') : `${pct}%`}
        </span>
      </div>
      <Progress value={pct ?? 0} tone={tone} size="sm" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── actions

function YearActions({
  year,
  deletable,
  onEdit,
  onSetCurrent,
  onClose,
  onDelete,
  onToggleTerms,
  expanded,
}: {
  year: AcademicYear;
  deletable: boolean | null;
  onEdit: () => void;
  onSetCurrent: () => void;
  onClose: () => void;
  onDelete: () => void;
  onToggleTerms: () => void;
  expanded: boolean;
}) {
  const { t } = useI18n();

  return (
    <>
      <Button variant="ghost" size="sm" onClick={onToggleTerms}>
        {expanded ? t('structure.hideTerms') : t('structure.terms')}
      </Button>

      {year.status === 'UPCOMING' ? (
        <>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            {t('academicYear.edit')}
          </Button>
          <Button variant="outline" size="sm" onClick={onSetCurrent}>
            {t('academicYear.setCurrent')}
          </Button>
          {deletable === true ? (
            <Button variant="ghost" size="sm" onClick={onDelete}>
              {t('common.delete')}
            </Button>
          ) : deletable === false ? (
            <span className="text-xs text-muted-foreground" title={t('academicYear.deleteBlocked')}>
              {t('academicYear.deleteBlockedShort')}
            </span>
          ) : null}
        </>
      ) : null}

      {year.status === 'ACTIVE' ? (
        <Button variant="outline" size="sm" onClick={onClose}>
          {t('academicYear.closeYear')}
        </Button>
      ) : null}
    </>
  );
}

// ─────────────────────────────────────────────────────────────── activation validation

function ActivationValidation({
  checks,
}: {
  checks: AcademicYearReadiness['activation']['checks'];
}) {
  const { t } = useI18n();
  const missing = checks.filter((c) => !c.ok);
  if (missing.length === 0) return null;
  return (
    <div className="rounded-xl border border-accent-warm/30 bg-accent-warm/10 p-4">
      <p className="text-sm font-medium text-accent-warm">{t('academicYear.cannotActivate')}</p>
      <ul className="mt-2 space-y-1.5">
        {missing.map((c) => (
          <li key={c.key} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">✗ {c.label}</span>
            {c.resolveRoute ? (
              <a
                href={c.resolveRoute}
                className="text-xs font-medium text-primary-strong hover:underline"
              >
                {t('academicYear.resolve')} →
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── set current

function SetCurrentDialog({
  open,
  year,
  readiness,
  onClose,
  onDone,
}: {
  open: boolean;
  year: AcademicYear;
  readiness: AcademicYearReadiness | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const canActivate = readiness?.activation.canActivate ?? false;

  async function confirm() {
    setBusy(true);
    try {
      await academicYearsApi.setCurrent(year.id);
      toast.success(t('academicYear.setCurrentDone'));
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('academicYear.setCurrentTitle')}
      description={year.name}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void confirm()} disabled={busy || !canActivate}>
            {t('academicYear.setCurrentConfirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p>{t('academicYear.setCurrentExplain')}</p>
        <div className="rounded-lg border border-border bg-secondary/40 p-3">
          <p className="mb-1 font-medium">{t('academicYear.setCurrentChangesOnly')}</p>
          <p className="text-muted-foreground">{t('academicYear.setCurrentDefaults')}</p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/40 p-3">
          <p className="mb-1 font-medium">{t('academicYear.setCurrentDoesNot')}</p>
          <p className="text-muted-foreground">{t('academicYear.setCurrentDoesNotList')}</p>
        </div>
        {readiness && !canActivate ? (
          <ActivationValidation checks={readiness.activation.checks} />
        ) : null}
      </div>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────── close wizard

function CloseWizard({
  open,
  year,
  overview,
  readiness,
  onClose,
  onDone,
}: {
  open: boolean;
  year: AcademicYear;
  overview: AcademicYearOverview | null;
  readiness: AcademicYearReadiness | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const steps = [
    { key: 'summary', title: t('academicYear.close.step1') },
    { key: 'validation', title: t('academicYear.close.step2') },
    { key: 'confirm', title: t('academicYear.close.step3') },
    { key: 'done', title: t('academicYear.close.step4') },
  ];

  const closeChecks = readiness?.close.checks ?? [];
  const blockers = closeChecks.filter((c) => c.severity === 'blocker' && !c.ok);
  const canClose = blockers.length === 0;

  async function commitClose() {
    setBusy(true);
    try {
      await academicYearsApi.close(year.id);
      toast.success(t('academicYear.close.done'));
      setStep(3);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('academicYear.close.title')}
      description={year.name}
      className="max-w-2xl"
      footer={
        <CloseWizardFooter
          step={step}
          busy={busy}
          canClose={canClose}
          onCancel={onClose}
          onBack={() => setStep((s) => Math.max(0, s - 1))}
          onNext={() => setStep((s) => s + 1)}
          onCommit={() => void commitClose()}
          onFinish={onDone}
        />
      }
    >
      <div className="space-y-4">
        <Stepper steps={steps} current={step} />

        {step === 0 ? <CloseSummary overview={overview} /> : null}
        {step === 1 ? <CloseValidation checks={closeChecks} /> : null}
        {step === 2 ? <CloseConfirm /> : null}
        {step === 3 ? (
          <div className="rounded-xl border border-accent-cool/30 bg-accent-cool/10 p-6 text-center">
            <p className="text-lg font-semibold text-accent-cool">
              ✓ {t('academicYear.close.done')}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('academicYear.close.doneDetail')}
            </p>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

function CloseWizardFooter({
  step,
  busy,
  canClose,
  onCancel,
  onBack,
  onNext,
  onCommit,
  onFinish,
}: {
  step: number;
  busy: boolean;
  canClose: boolean;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
  onCommit: () => void;
  onFinish: () => void;
}) {
  const { t } = useI18n();
  if (step === 3) {
    return <Button onClick={onFinish}>{t('common.done')}</Button>;
  }
  return (
    <>
      <Button variant="outline" onClick={step === 0 ? onCancel : onBack}>
        {step === 0 ? t('common.cancel') : t('common.back')}
      </Button>
      {step < 2 ? (
        <Button onClick={onNext} disabled={step === 1 && !canClose}>
          {t('common.next')}
        </Button>
      ) : (
        <Button onClick={onCommit} disabled={busy || !canClose}>
          {t('academicYear.close.confirmButton')}
        </Button>
      )}
    </>
  );
}

function CloseSummary({ overview }: { overview: AcademicYearOverview | null }) {
  const { t } = useI18n();
  if (!overview) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }
  const rows: [string, string | number][] = [
    [t('academicYear.kpi.students'), overview.studentCount],
    [t('academicYear.kpi.enrollments'), overview.activeEnrollments],
    [t('academicYear.summary.graduating'), overview.graduatingStudents],
    [t('academicYear.summary.withdrawn'), overview.withdrawnStudents],
    [t('academicYear.kpi.outstanding'), fmtMoney(overview.outstandingFees)],
    [t('academicYear.kpi.unverified'), overview.unverifiedPayments],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {rows.map(([label, value]) => (
        <StatCard key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function CloseValidation({ checks }: { checks: AcademicYearReadiness['close']['checks'] }) {
  const { t } = useI18n();
  return (
    <ul className="space-y-2">
      {checks.map((c) => (
        <li
          key={c.key}
          className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
        >
          <span className="flex items-center gap-2">
            <span className={c.ok ? 'text-accent-cool' : 'text-accent-warm'}>
              {c.ok ? '✓' : '✗'}
            </span>
            <span>{c.label}</span>
            {c.severity === 'info' ? (
              <Badge tone="muted">{t('academicYear.advisory')}</Badge>
            ) : null}
          </span>
          {!c.ok && c.resolveRoute ? (
            <a
              href={c.resolveRoute}
              className="text-xs font-medium text-primary-strong hover:underline"
            >
              {t('academicYear.resolve')} →
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function CloseConfirm() {
  const { t } = useI18n();
  const locks = t('academicYear.close.locksList').split('|').filter(Boolean);
  const preserves = t('academicYear.close.preservesList').split('|').filter(Boolean);
  const doesNot = t('academicYear.close.doesNotList').split('|').filter(Boolean);
  return (
    <div className="space-y-3 text-sm">
      <p>{t('academicYear.close.confirmIntro')}</p>
      <div className="rounded-lg border border-border bg-secondary/40 p-3">
        <p className="mb-2 font-medium">{t('academicYear.close.locks')}</p>
        <ul className="space-y-1 text-muted-foreground">
          {locks.map((l) => (
            <li key={l}>🔒 {l}</li>
          ))}
          {preserves.map((l) => (
            <li key={l}>✓ {l}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-border bg-secondary/40 p-3">
        <p className="mb-2 font-medium">{t('academicYear.close.doesNot')}</p>
        <ul className="space-y-1 text-muted-foreground">
          {doesNot.map((l) => (
            <li key={l}>• {l}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── create dialog

function CreateYearDialog({
  open,
  campusId,
  onClose,
  onCreated,
}: {
  open: boolean;
  campusId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    registrationStartDate: '',
    registrationEndDate: '',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open)
      setForm({
        name: '',
        startDate: '',
        endDate: '',
        registrationStartDate: '',
        registrationEndDate: '',
      });
  }, [open]);

  async function create() {
    setBusy(true);
    try {
      await academicYearsApi.create({
        campusId,
        name: form.name,
        startDate: form.startDate,
        endDate: form.endDate,
        registrationStartDate: form.registrationStartDate || null,
        registrationEndDate: form.registrationEndDate || null,
        status: 'UPCOMING',
      });
      toast.success(t('academicYear.created'));
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  const valid = form.name && form.startDate && form.endDate;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('academicYear.addYear')}
      description={t('academicYear.addYearHint')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void create()} disabled={busy || !valid}>
            {t('common.add')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={t('structure.name')}>
          <Input
            placeholder={t('structure.yearNamePlaceholder')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('structure.start')}>
            <DatePicker
              value={form.startDate}
              onChange={(value) => setForm({ ...form, startDate: value })}
            />
          </Field>
          <Field label={t('structure.end')}>
            <DatePicker
              value={form.endDate}
              onChange={(value) => setForm({ ...form, endDate: value })}
            />
          </Field>
        </div>
        <p className="pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('academicYear.registration')}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('academicYear.registrationStart')}>
            <DatePicker
              value={form.registrationStartDate}
              onChange={(value) => setForm({ ...form, registrationStartDate: value })}
            />
          </Field>
          <Field label={t('academicYear.registrationEnd')}>
            <DatePicker
              value={form.registrationEndDate}
              onChange={(value) => setForm({ ...form, registrationEndDate: value })}
            />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────── edit dialog

function EditYearDialog({
  open,
  year,
  onClose,
  onSaved,
}: {
  open: boolean;
  year: AcademicYear;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    registrationStartDate: '',
    registrationEndDate: '',
  });
  const [busy, setBusy] = useState(false);

  const iso = (d?: string | null) => (d ? d.slice(0, 10) : '');

  useEffect(() => {
    if (open)
      setForm({
        name: year.name,
        startDate: iso(year.startDate),
        endDate: iso(year.endDate),
        registrationStartDate: iso(year.registrationStartDate),
        registrationEndDate: iso(year.registrationEndDate),
      });
  }, [open, year]);

  async function save() {
    setBusy(true);
    try {
      await academicYearsApi.update(year.id, {
        name: form.name,
        startDate: form.startDate,
        endDate: form.endDate,
        registrationStartDate: form.registrationStartDate || null,
        registrationEndDate: form.registrationEndDate || null,
      });
      toast.success(t('academicYear.saved'));
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  const valid = form.name && form.startDate && form.endDate;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('academicYear.editTitle')}
      description={year.name}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void save()} disabled={busy || !valid}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={t('structure.name')}>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('structure.start')}>
            <DatePicker
              value={form.startDate}
              onChange={(value) => setForm({ ...form, startDate: value })}
            />
          </Field>
          <Field label={t('structure.end')}>
            <DatePicker
              value={form.endDate}
              onChange={(value) => setForm({ ...form, endDate: value })}
            />
          </Field>
        </div>
        <p className="pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('academicYear.registration')}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('academicYear.registrationStart')}>
            <DatePicker
              value={form.registrationStartDate}
              onChange={(value) => setForm({ ...form, registrationStartDate: value })}
            />
          </Field>
          <Field label={t('academicYear.registrationEnd')}>
            <DatePicker
              value={form.registrationEndDate}
              onChange={(value) => setForm({ ...form, registrationEndDate: value })}
            />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────── semesters (inline manage)

function Semesters({ academicYearId, readOnly }: { academicYearId: string; readOnly: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const [terms, setTerms] = useState<Semester[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', sequence: '', startDate: '', endDate: '' });

  const load = useCallback(() => {
    semestersApi
      .list(academicYearId)
      .then((rows) => setTerms([...rows].sort((a, b) => a.sequence - b.sequence)))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load terms'));
  }, [academicYearId, toast]);

  useEffect(() => load(), [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await semestersApi.create({
        academicYearId,
        name: form.name,
        sequence: Number(form.sequence) || 1,
        startDate: form.startDate,
        endDate: form.endDate,
      });
      setForm({ name: '', sequence: '', startDate: '', endDate: '' });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-background/40 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t('structure.terms')}
      </p>

      <div className="space-y-1.5">
        {terms.map((s) =>
          editingId === s.id ? (
            <SemesterEditRow
              key={s.id}
              term={s}
              onCancel={() => setEditingId(null)}
              onSaved={() => {
                setEditingId(null);
                load();
              }}
            />
          ) : (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card/60 px-3 py-2"
            >
              <div className="flex items-center gap-2 text-sm">
                <Badge tone="muted">{s.sequence}</Badge>
                <span className="font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground">
                  {fmtDate(s.startDate)} → {fmtDate(s.endDate)}
                </span>
              </div>
              {!readOnly ? (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(s.id)}>
                    {t('academicYear.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      void semestersApi
                        .remove(s.id)
                        .then(load)
                        .catch((e) => toast.error(e instanceof Error ? e.message : 'Delete failed'))
                    }
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              ) : null}
            </div>
          ),
        )}
        {terms.length === 0 ? (
          <span className="text-xs text-muted-foreground">{t('structure.noTerms')}</span>
        ) : null}
      </div>

      {!readOnly ? (
        <form onSubmit={(e) => void create(e)} className="flex flex-wrap items-end gap-2 pt-1">
          <Field label="#">
            <Input
              className="h-8 w-14"
              type="number"
              value={form.sequence}
              onChange={(e) => setForm({ ...form, sequence: e.target.value })}
              required
            />
          </Field>
          <Field label={t('structure.termName')}>
            <Input
              className="h-8 w-32"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <Field label={t('structure.start')}>
            <DatePicker
              value={form.startDate}
              onChange={(value) => setForm({ ...form, startDate: value })}
              className="h-8"
              required
            />
          </Field>
          <Field label={t('structure.end')}>
            <DatePicker
              value={form.endDate}
              onChange={(value) => setForm({ ...form, endDate: value })}
              className="h-8"
              required
            />
          </Field>
          <Button type="submit" size="sm">
            {t('structure.addTerm')}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

/** Inline editor for a single term — name, sequence, and start/end dates. */
function SemesterEditRow({
  term,
  onCancel,
  onSaved,
}: {
  term: Semester;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const iso = (d: string) => d.slice(0, 10);
  const [form, setForm] = useState({
    name: term.name,
    sequence: String(term.sequence),
    startDate: iso(term.startDate),
    endDate: iso(term.endDate),
  });
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await semestersApi.update(term.id, {
        name: form.name,
        sequence: Number(form.sequence) || 1,
        startDate: form.startDate,
        endDate: form.endDate,
      });
      toast.success(t('academicYear.termSaved'));
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void save(e)}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2"
    >
      <Field label="#">
        <Input
          className="h-8 w-14"
          type="number"
          value={form.sequence}
          onChange={(e) => setForm({ ...form, sequence: e.target.value })}
          required
        />
      </Field>
      <Field label={t('structure.termName')}>
        <Input
          className="h-8 w-32"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </Field>
      <Field label={t('structure.start')}>
        <DatePicker
          value={form.startDate}
          onChange={(value) => setForm({ ...form, startDate: value })}
          className="h-8"
          required
        />
      </Field>
      <Field label={t('structure.end')}>
        <DatePicker
          value={form.endDate}
          onChange={(value) => setForm({ ...form, endDate: value })}
          className="h-8"
          required
        />
      </Field>
      <Button type="submit" size="sm" disabled={busy}>
        {t('common.save')}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>
        {t('common.cancel')}
      </Button>
    </form>
  );
}
