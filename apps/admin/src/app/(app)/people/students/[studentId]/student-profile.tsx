'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useI18n } from '@/components/i18n-provider';
import { usePrincipal } from '@/components/shell';
import { Badge, Button, Card, Spinner, Tabs, TabsList, TabsTrigger, useToast } from '@axa/platform';
import { useConfirm } from '@/components/confirm';
import { fullNameAr, fullNameEn, studentsApi, type Student } from '@/lib/people';
import { StudentEditor } from '../student-editor';
import { PlaceholderTab } from './tabs/placeholder-tab';

const TabSpinner = () => (
  <div className="flex justify-center py-16">
    <Spinner />
  </div>
);

// Heavy tab panels are code-split: a tab's bundle + data load only when it becomes active.
const OverviewTab = dynamic(() => import('./tabs/overview-tab').then((m) => m.OverviewTab), {
  loading: TabSpinner,
});
const ParentsTab = dynamic(() => import('./tabs/parents-tab').then((m) => m.ParentsTab), {
  loading: TabSpinner,
});
const FinanceTab = dynamic(() => import('./tabs/finance-tab').then((m) => m.FinanceTab), {
  loading: TabSpinner,
});
const TransportTab = dynamic(() => import('./tabs/transport-tab').then((m) => m.TransportTab), {
  loading: TabSpinner,
});
const VaccinesTab = dynamic(() => import('./tabs/vaccines-tab').then((m) => m.VaccinesTab), {
  loading: TabSpinner,
});

interface TabDef {
  key: string;
  labelKey: string;
  /** Permission required to see the tab (falls back to visible when unset). */
  perm?: string;
}

// Single unified tab layout reused by every module — only the default `?tab=` differs per entry.
const TABS: TabDef[] = [
  { key: 'overview', labelKey: 'studentProfile.tabOverview' },
  { key: 'parents', labelKey: 'people.parents' },
  { key: 'academics', labelKey: 'studentProfile.tabAcademics' },
  { key: 'attendance', labelKey: 'nav.attendance' },
  { key: 'finance', labelKey: 'nav.finance', perm: 'finance:manage' },
  { key: 'transport', labelKey: 'nav.fleet' },
  { key: 'medical', labelKey: 'studentProfile.tabMedical' },
  { key: 'documents', labelKey: 'studentProfile.tabDocuments' },
  { key: 'vaccines', labelKey: 'people.vaccines' },
  { key: 'communication', labelKey: 'nav.communication' },
  { key: 'timeline', labelKey: 'studentProfile.tabTimeline' },
  { key: 'audit', labelKey: 'studentProfile.tabAudit' },
];

/**
 * Full-page Student Profile — the single workspace for one student, shared by every module.
 * The identity header stays mounted while tabs switch; the active tab is driven entirely by the
 * `?tab=` query param so refresh, deep links and browser back/forward all work. Each tab is
 * lazy-loaded and fetches its own data, so inactive tabs cost nothing.
 */
export function StudentProfile() {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const principal = usePrincipal();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams<{ studentId: string }>();
  const studentId = params.studentId;

  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // Deletion is only for a draft student with no dependent records; otherwise the API blocks it and we
  // hide Delete, pointing the registrar to Withdraw / Cancel Admission (Decision — deletion rules).
  const [deletable, setDeletable] = useState(false);

  const canSee = useMemo(() => {
    const held = new Set(principal.permissions);
    return (perm?: string) => !perm || held.has(perm) || principal.isPlatform;
  }, [principal]);

  const visibleTabs = useMemo(() => TABS.filter((tab) => canSee(tab.perm)), [canSee]);

  // Active tab from the URL (single source of truth) — defaults to the first visible tab.
  const requested = searchParams.get('tab') ?? 'overview';
  const activeTab = visibleTabs.some((tb) => tb.key === requested)
    ? requested
    : (visibleTabs[0]?.key ?? 'overview');

  const setTab = useCallback(
    (key: string) => {
      const qs = new URLSearchParams(searchParams.toString());
      qs.set('tab', key);
      // Template-literal path isn't statically a typed Route; cast as elsewhere in the app.
      // Required for `next build` (typedRoutes); local type-aware lint lacks .next/types and
      // sees it as redundant — disable that rule here.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      router.push(`${pathname}?${qs.toString()}` as never);
    },
    [router, pathname, searchParams],
  );

  const loadStudent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStudent(await studentsApi.get(studentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load student');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void loadStudent();
  }, [loadStudent]);

  // Whether Delete may be shown (else the registrar withdraws / cancels the admission).
  useEffect(() => {
    let active = true;
    studentsApi
      .deletability(studentId)
      .then((d) => active && setDeletable(d.deletable))
      .catch(() => active && setDeletable(false));
    return () => {
      active = false;
    };
  }, [studentId]);

  async function remove() {
    if (!student) return;
    if (!(await confirm())) return;
    try {
      await studentsApi.remove(student.id);
      toast.success(t('people.studentDeleted'));
      router.push('/people/students');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-12 text-center">
        <p className="text-sm text-destructive" role="alert">
          {error ?? t('people.noStudents')}
        </p>
        <Link href="/people/students">
          <Button variant="outline">{t('studentProfile.backToStudents')}</Button>
        </Link>
      </div>
    );
  }

  const initials =
    `${student.firstNameEn[0] ?? ''}${student.lastNameEn[0] ?? ''}`.toUpperCase() || '?';

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <Link
        href="/people/students"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <span aria-hidden="true">←</span> {t('studentProfile.backToStudents')}
      </Link>

      {/* Persistent identity header — stays mounted across tab switches. */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-secondary font-display text-2xl font-semibold">
              {initials}
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-3">
                <h1 className="font-display text-2xl font-semibold">{fullNameEn(student)}</h1>
                <span className="text-muted-foreground" dir="rtl">
                  {fullNameAr(student)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge tone={student.status === 'ACTIVE' ? 'success' : 'muted'}>
                  {student.status}
                </Badge>
                <Meta label={t('people.studentNumber')} value={student.studentNumber} />
                <Meta label={t('people.studentNo')} value={student.moeStudentNumber} />
                <Meta label={t('people.nationalId')} value={student.nationalId} />
                <Meta
                  label={t('people.admitted')}
                  value={student.enrollmentDate ? student.enrollmentDate.slice(0, 10) : null}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              {t('people.edit')}
            </Button>
            <Link href="/people/cards">
              <Button variant="outline" size="sm">
                {t('studentProfile.printCard')}
              </Button>
            </Link>
            <details className="group relative">
              <summary className="flex h-9 cursor-pointer list-none items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-accent [&::-webkit-details-marker]:hidden">
                {t('studentProfile.moreActions')}
              </summary>
              <div className="absolute end-0 z-20 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-card shadow-card">
                <Link
                  href={{ pathname: '/finance', query: { studentId: student.id } }}
                  className="block px-3 py-2 text-sm hover:bg-accent"
                >
                  {t('studentProfile.openInFinance')}
                </Link>
                {deletable ? (
                  <button
                    type="button"
                    onClick={() => void remove()}
                    className="block w-full px-3 py-2 text-start text-sm text-destructive hover:bg-accent"
                  >
                    {t('common.delete')}
                  </button>
                ) : (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    {t('studentProfile.cannotDelete')}
                  </div>
                )}
              </div>
            </details>
          </div>
        </div>
      </Card>

      {/* Unified tab strip */}
      <Tabs value={activeTab} onValueChange={setTab}>
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto flex-wrap">
            {visibleTabs.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key}>
                {t(tab.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {/* Active tab panel (lazy-loaded) */}
      <div role="tabpanel" className="focus-visible:outline-none">
        <TabPanel activeTab={activeTab} student={student} onChanged={loadStudent} />
      </div>

      {editing ? (
        <StudentEditor
          student={student}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await loadStudent();
          }}
        />
      ) : null}
    </div>
  );
}

function TabPanel({
  activeTab,
  student,
  onChanged,
}: {
  activeTab: string;
  student: Student;
  onChanged?: (() => void | Promise<void>) | undefined;
}): ReactNode {
  switch (activeTab) {
    case 'overview':
      return <OverviewTab student={student} onChanged={onChanged} />;
    case 'parents':
      return <ParentsTab student={student} />;
    case 'finance':
      return <FinanceTab studentId={student.id} />;
    case 'transport':
      return <TransportTab student={student} />;
    case 'vaccines':
      return <VaccinesTab studentId={student.id} />;
    case 'medical':
      return <PlaceholderTab titleKey="studentProfile.tabMedical" />;
    case 'academics':
      return <PlaceholderTab titleKey="studentProfile.tabAcademics" />;
    case 'attendance':
      return <PlaceholderTab titleKey="nav.attendance" />;
    case 'documents':
      return <PlaceholderTab titleKey="studentProfile.tabDocuments" />;
    case 'communication':
      return <PlaceholderTab titleKey="nav.communication" />;
    case 'timeline':
      return <PlaceholderTab titleKey="studentProfile.tabTimeline" />;
    case 'audit':
      return <PlaceholderTab titleKey="studentProfile.tabAudit" />;
    default:
      return <OverviewTab student={student} onChanged={onChanged} />;
  }
}

function Meta({ label, value }: { label: string; value?: string | null | undefined }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70">
        {label}
      </span>
      <span className="font-mono text-foreground">{value}</span>
    </span>
  );
}
