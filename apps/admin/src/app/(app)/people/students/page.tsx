'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  EmptyState,
  Field,
  Input,
  Select,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  Textarea,
  cn,
  useToast,
} from '@axa/platform';
import { useConfirm } from '@/components/confirm';
import { studentsApi, type ImportResult, type Student } from '@/lib/people';
import { sectionsApi, type Section } from '@/lib/structure';
import { StudentEditor, STUDENT_STATUSES, GENDERS } from './student-editor';

const STATUS_TONE: Record<string, 'success' | 'muted' | 'warning' | 'danger'> = {
  ACTIVE: 'success',
  INACTIVE: 'muted',
  GRADUATED: 'warning',
  WITHDRAWN: 'danger',
};

export default function StudentsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Student | null>(null);

  // Opening a student no longer pops a modal — it routes to the full-page Student Profile.
  const openProfile = useCallback(
    (s: Student) => router.push(`/people/students/${s.id}`),
    [router],
  );
  const [search, setSearch] = useState('');
  const [sections, setSections] = useState<Section[]>([]);

  // Client-side directory filters (server search handles the free-text query).
  const [fStatus, setFStatus] = useState('');
  const [fGrade, setFGrade] = useState('');
  const [fSection, setFSection] = useState('');
  const [fGender, setFGender] = useState('');

  const load = useCallback(async (query?: string) => {
    try {
      setStudents(await studentsApi.list(query));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Sections (with their grade) let us label a student's class and drive the grade/section filters.
    sectionsApi
      .list()
      .then(setSections)
      .catch(() => undefined);
  }, []);

  // Load students on mount and whenever the search term changes (debounced server-side search).
  useEffect(() => {
    const id = setTimeout(() => void load(search.trim() || undefined), 300);
    return () => clearTimeout(id);
  }, [search, load]);

  const gradeName = useCallback(
    (sectionId?: string | null): string =>
      sections.find((s) => s.id === sectionId)?.grade?.nameEn ?? '—',
    [sections],
  );

  const sectionName = useCallback(
    (sectionId?: string | null): string => sections.find((s) => s.id === sectionId)?.name ?? '—',
    [sections],
  );

  // Grades + sections for the filter dropdowns (derived from the sections master list).
  const grades = useMemo(
    () =>
      [
        ...new Map(
          sections
            .filter((s) => s.grade)
            .map((s) => [
              s.grade!.id,
              { id: s.grade!.id, name: s.grade!.nameEn, level: s.grade!.level },
            ]),
        ).values(),
      ].sort((a, b) => a.level - b.level),
    [sections],
  );
  const sectionsForGrade = useMemo(
    () => (fGrade ? sections.filter((s) => s.grade?.id === fGrade) : sections),
    [sections, fGrade],
  );

  const filtered = useMemo(
    () =>
      students.filter(
        (s) =>
          (!fStatus || s.status === fStatus) &&
          (!fGrade || sections.find((x) => x.id === s.sectionId)?.grade?.id === fGrade) &&
          (!fSection || s.sectionId === fSection) &&
          (!fGender || s.gender === fGender),
      ),
    [students, sections, fStatus, fGrade, fSection, fGender],
  );

  const stats = useMemo(() => {
    const c = { total: students.length, ACTIVE: 0, INACTIVE: 0, GRADUATED: 0, WITHDRAWN: 0 };
    for (const s of students) if (s.status in c) c[s.status as keyof typeof c]++;
    return c;
  }, [students]);

  const hasFilters = Boolean(fStatus || fGrade || fSection || fGender);
  const clearFilters = () => {
    setFStatus('');
    setFGrade('');
    setFSection('');
    setFGender('');
  };

  function exportCsv() {
    const header = [
      'Student No.',
      'Name (EN)',
      'Name (AR)',
      'Grade',
      'Section',
      'Status',
      'Admitted',
    ];
    const rows = filtered.map((s) => [
      s.moeStudentNumber ?? '',
      `${s.firstNameEn} ${s.lastNameEn}`.trim(),
      `${s.firstNameAr} ${s.lastNameAr}`.trim(),
      gradeName(s.sectionId),
      sectionName(s.sectionId),
      s.status,
      s.enrollmentDate ? s.enrollmentDate.slice(0, 10) : '',
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `students-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function remove(student: Student) {
    if (!(await confirm())) return;
    try {
      await studentsApi.remove(student.id);
      toast.success(t('people.studentDeleted'));
      await load(search.trim() || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <Shell>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {/* Header + primary actions. Registration is NOT done here — it lives in Admissions. */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-semibold">{t('nav.people')}</h1>
            <p className="text-sm text-muted-foreground">{t('people.directorySubtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
              <DownloadIcon />
              {t('common.export')}
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <UploadIcon />
              {t('people.importStudents')}
            </Button>
            <Link href="/admissions">
              <Button>
                <PlusIcon />
                {t('people.newRegistration')}
              </Button>
            </Link>
          </div>
        </header>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {/* Statistics */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label={t('people.statTotal')}
            value={stats.total}
            tone="primary"
            loading={loading}
          />
          <StatCard
            label={t('people.statActive')}
            value={stats.ACTIVE}
            tone="cool"
            loading={loading}
          />
          <StatCard
            label={t('people.statInactive')}
            value={stats.INACTIVE}
            tone="muted"
            loading={loading}
          />
          <StatCard
            label={t('people.statGraduated')}
            value={stats.GRADUATED}
            tone="warm"
            loading={loading}
          />
          <StatCard
            label={t('people.statWithdrawn')}
            value={stats.WITHDRAWN}
            tone="danger"
            loading={loading}
          />
        </section>

        {/* Search + filters */}
        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t('common.search')} className="lg:col-span-2">
              <Input
                value={search}
                placeholder={t('people.searchPlaceholder')}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
            <Field label={t('common.status')}>
              <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                <option value="">{t('people.allStatuses')}</option>
                {STUDENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('people.gender')}>
              <Select value={fGender} onChange={(e) => setFGender(e.target.value)}>
                <option value="">{t('people.allGenders')}</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {t(`people.${g.toLowerCase()}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('structure.grade')}>
              <Select
                value={fGrade}
                onChange={(e) => {
                  setFGrade(e.target.value);
                  setFSection('');
                }}
              >
                <option value="">{t('people.allGrades')}</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('structure.section')}>
              <Select value={fSection} onChange={(e) => setFSection(e.target.value)}>
                <option value="">{t('people.allSections')}</option>
                {sectionsForGrade.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.grade ? `${s.grade.nameEn} · ${s.name}` : s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end">
              <Button
                variant="ghost"
                onClick={clearFilters}
                disabled={!hasFilters}
                className="w-full"
              >
                {t('common.dismiss')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Directory table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>{t('people.studentNo')}</TH>
                  <TH>{t('common.name')}</TH>
                  <TH>{t('structure.grade')}</TH>
                  <TH>{t('structure.section')}</TH>
                  <TH>{t('people.admitted')}</TH>
                  <TH>{t('common.status')}</TH>
                  <TH className="text-end">{t('common.actions')}</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((s) => (
                  <TR key={s.id}>
                    <TD className="font-mono text-xs text-muted-foreground">
                      {s.moeStudentNumber || '—'}
                    </TD>
                    <TD>
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary-strong"
                        >
                          {(s.firstNameEn.trim()[0] ?? '?').toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <button
                            type="button"
                            className="block truncate text-start font-medium text-foreground hover:text-primary-strong hover:underline"
                            onClick={() => openProfile(s)}
                          >
                            {s.firstNameEn} {s.lastNameEn}
                          </button>
                          <span className="block truncate text-xs text-muted-foreground" dir="rtl">
                            {s.firstNameAr} {s.lastNameAr}
                          </span>
                        </span>
                      </div>
                    </TD>
                    <TD>{gradeName(s.sectionId)}</TD>
                    <TD>{sectionName(s.sectionId)}</TD>
                    <TD className="font-mono text-xs">
                      {s.enrollmentDate ? s.enrollmentDate.slice(0, 10) : '—'}
                    </TD>
                    <TD>
                      <Badge tone={STATUS_TONE[s.status] ?? 'muted'}>{s.status}</Badge>
                    </TD>
                    <TD>
                      <div className="flex items-center justify-end gap-1">
                        <IconButton label={t('people.view')} onClick={() => openProfile(s)}>
                          <EyeIcon />
                        </IconButton>
                        <IconButton label={t('people.edit')} onClick={() => setEditing(s)}>
                          <PencilIcon />
                        </IconButton>
                        <IconButton
                          label={t('common.delete')}
                          onClick={() => void remove(s)}
                          danger
                        >
                          <TrashIcon />
                        </IconButton>
                      </div>
                    </TD>
                  </TR>
                ))}
                {filtered.length === 0 ? (
                  <TR>
                    <TD colSpan={7}>
                      <EmptyState
                        title={
                          students.length === 0
                            ? t('people.noStudents')
                            : t('people.noStudentsMatch')
                        }
                      />
                    </TD>
                  </TR>
                ) : null}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        {/* Separation-of-concerns banner: registration happens in Admissions. */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">{t('people.registerBannerTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('people.registerBannerBody')}</p>
            </div>
            <Link href="/admissions">
              <Button variant="outline">
                {t('people.goToAdmissions')}
                <span aria-hidden="true">→</span>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {editing ? (
        <StudentEditor
          student={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load(search.trim() || undefined);
          }}
        />
      ) : null}

      <Dialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title={t('people.importStudents')}
        description={t('people.bulkImport')}
      >
        <ImportStudents
          onImported={() => load(search.trim() || undefined)}
          onResult={setImportResult}
          onError={setError}
        />
        {importResult ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t('people.importedSummary')
              .replace('{created}', String(importResult.created))
              .replace('{failed}', String(importResult.failed.length))}
          </p>
        ) : null}
      </Dialog>
    </Shell>
  );
}

/** Compact KPI tile for the directory statistics row. */
function StatCard({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value: number;
  tone: 'primary' | 'cool' | 'warm' | 'danger' | 'muted';
  loading: boolean;
}) {
  const toneClass: Record<typeof tone, string> = {
    primary: 'text-foreground',
    cool: 'text-accent-cool',
    warm: 'text-accent-warm',
    danger: 'text-destructive',
    muted: 'text-muted-foreground',
  };
  return (
    <Card className="h-full">
      <CardContent className="p-4">
        <p className="truncate text-sm text-muted-foreground">{label}</p>
        {loading ? (
          <div className="mt-1 h-8 w-16 animate-pulse rounded bg-secondary/60" aria-hidden />
        ) : (
          <p
            className={cn(
              'mt-0.5 font-display text-2xl font-semibold tabular-nums',
              toneClass[tone],
            )}
          >
            {value.toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Square icon action button used in the directory row. */
function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent',
        danger ? 'hover:text-destructive' : 'hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function iconProps(size = 16) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

function EyeIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M12 4v11M7 11l5 4 5-4M5 20h14" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M12 20V9M7 13l5-4 5 4M5 5h14" />
    </svg>
  );
}

function ImportStudents({
  onImported,
  onResult,
  onError,
}: {
  onImported: () => Promise<void>;
  onResult: (r: ImportResult) => void;
  onError: (m: string) => void;
}) {
  const { t } = useI18n();
  const [csv, setCsv] = useState(
    'firstNameEn,lastNameEn,firstNameAr,lastNameAr,moeStudentNumber\n',
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      onResult(await studentsApi.import(csv));
      await onImported();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Import failed');
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-2">
      <Field label="CSV">
        <Textarea
          className="h-28 font-mono text-xs"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
      </Field>
      <Button type="submit" variant="secondary">
        {t('people.importCsv')}
      </Button>
    </form>
  );
}
