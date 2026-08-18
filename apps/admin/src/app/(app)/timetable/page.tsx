'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { classroomLabel } from '@school/domain';
import { Shell } from '@/components/shell';
import { TimeCounter, minutesBetween, shiftTime } from '@/components/time-counter';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  Field,
  Input,
  PageHeader,
  Select,
  useToast,
  type Tone,
} from '@munaxa/ui';
import {
  academicYearsApi,
  campusesApi,
  schoolsApi,
  sectionsApi,
  semestersApi,
  type AcademicYear,
  type Campus,
  type School,
  type Section,
  type Semester,
} from '@/lib/structure';
import { teachersApi, type Teacher } from '@/lib/people';
import {
  plansApi,
  subjectsApi,
  type ClassUpdate,
  type DayOfWeek,
  type EditableClass,
  type PlanOverview,
  type ScheduleType,
  type SchedulePlan,
  type Subject,
} from '@/lib/scheduling';

// Jordan working week.
const DAYS: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU'];
const DAY_LABEL: Record<DayOfWeek, string> = {
  SUN: 'Sunday',
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
};
const STATUS_TONE: Record<SchedulePlan['status'], Tone> = {
  DRAFT: 'warning',
  PUBLISHED: 'success',
  ARCHIVED: 'muted',
};

/** Where the open timetable is remembered for the rest of the browser session. */
const SELECTION_KEY = 'munaxa.timetable.selection';

/** Falls back to a first-period-shaped slot when nothing on the grid says otherwise. */
const DEFAULT_START = '08:00';
const DEFAULT_END = '08:45';

const emptyClassForm = (
  day: DayOfWeek,
  classNumber: number,
  times: { startTime: string; endTime: string },
): ClassForm => ({
  dayOfWeek: day,
  classNumber: String(classNumber),
  startTime: times.startTime,
  endTime: times.endTime,
  subjectId: '',
  teacherId: '',
  locationId: '',
});

interface ClassForm {
  dayOfWeek: DayOfWeek;
  classNumber: string;
  startTime: string;
  endTime: string;
  subjectId: string;
  teacherId: string;
  locationId: string;
}

/**
 * The workspace keeps its selection — school, campus, year, semester, plan, classroom, schedule —
 * in the URL, so leaving for the subject catalogue and coming back lands on the timetable that was
 * open rather than an empty grid. It also makes an open timetable a link someone can share.
 */
export default function TimetablePage() {
  return (
    <Suspense fallback={null}>
      <TimetableWorkspace />
    </Suspense>
  );
}

function TimetableWorkspace() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Cascade selectors
  const [schools, setSchools] = useState<School[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [plans, setPlans] = useState<SchedulePlan[]>([]);
  const [schoolId, setSchoolId] = useState(() => searchParams.get('school') ?? '');
  const [campusId, setCampusId] = useState(() => searchParams.get('campus') ?? '');
  const [yearId, setYearId] = useState(() => searchParams.get('year') ?? '');
  const [semesterId, setSemesterId] = useState(() => searchParams.get('semester') ?? '');
  const [planId, setPlanId] = useState(() => searchParams.get('plan') ?? '');

  // Reference data
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [sections, setSections] = useState<Section[]>([]);

  // Working state
  const [overview, setOverview] = useState<PlanOverview | null>(null);
  const [sectionId, setSectionId] = useState(() => searchParams.get('classroom') ?? '');
  const [scheduleType, setScheduleType] = useState<ScheduleType>(() =>
    searchParams.get('schedule') === 'RAMADAN' ? 'RAMADAN' : 'REGULAR',
  );
  const [classes, setClasses] = useState<EditableClass[]>([]);
  const [editing, setEditing] = useState<{ form: ClassForm; id: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const plan = overview?.plan ?? null;
  const isDraft = plan?.status === 'DRAFT';

  // ── Keep the open timetable in the URL ──────────────────────────────────────
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (schoolId) params.set('school', schoolId);
    if (campusId) params.set('campus', campusId);
    if (yearId) params.set('year', yearId);
    if (semesterId) params.set('semester', semesterId);
    if (planId) params.set('plan', planId);
    if (sectionId) params.set('classroom', sectionId);
    if (scheduleType !== 'REGULAR') params.set('schedule', scheduleType);
    return params.toString();
  }, [schoolId, campusId, yearId, semesterId, planId, sectionId, scheduleType]);

  // Arriving with a bare /timetable — from the sidebar, or from a back link that had nothing to
  // carry — reopens the last timetable of this browser session instead of an empty workspace.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (searchParams.toString()) return;
    const saved = sessionStorage.getItem(SELECTION_KEY);
    if (!saved) return;
    const params = new URLSearchParams(saved);
    setSchoolId(params.get('school') ?? '');
    setCampusId(params.get('campus') ?? '');
    setYearId(params.get('year') ?? '');
    setSemesterId(params.get('semester') ?? '');
    setPlanId(params.get('plan') ?? '');
    setSectionId(params.get('classroom') ?? '');
    setScheduleType(params.get('schedule') === 'RAMADAN' ? 'RAMADAN' : 'REGULAR');
  }, [searchParams]);

  useEffect(() => {
    if (query) sessionStorage.setItem(SELECTION_KEY, query);
  }, [query]);

  useEffect(() => {
    // `replace`, not `push`: refining the selection is not a step to walk back through.
    if (searchParams.toString() === query) return;
    router.replace(query ? `/timetable?${query}` : '/timetable', { scroll: false });
  }, [query, router, searchParams]);

  /** Send the open timetable along, so the catalogue can hand the user back to exactly this grid. */
  const subjectsHref = {
    pathname: '/timetable/subjects',
    ...(query ? { query: { back: query } } : {}),
  };

  // ── Load cascade ────────────────────────────────────────────────────────────
  useEffect(() => {
    void schoolsApi
      .list()
      .then(setSchools)
      .catch(() => setSchools([]));
    void subjectsApi
      .list()
      .then(setSubjects)
      .catch(() => setSubjects([]));
    void teachersApi
      .list()
      .then(setTeachers)
      .catch(() => setTeachers([]));
    void sectionsApi
      .list()
      .then(setSections)
      .catch(() => setSections([]));
  }, []);

  useEffect(() => {
    if (!schoolId) return setCampuses([]);
    void campusesApi
      .list(schoolId)
      .then(setCampuses)
      .catch(() => setCampuses([]));
  }, [schoolId]);

  useEffect(() => {
    if (!campusId) return setYears([]);
    void academicYearsApi
      .list(campusId)
      .then(setYears)
      .catch(() => setYears([]));
  }, [campusId]);

  useEffect(() => {
    if (!yearId) return setSemesters([]);
    void semestersApi
      .list(yearId)
      .then(setSemesters)
      .catch(() => setSemesters([]));
  }, [yearId]);

  const reloadPlans = useCallback(async () => {
    if (!semesterId) return setPlans([]);
    setPlans(await plansApi.list(semesterId));
  }, [semesterId]);
  useEffect(() => {
    void reloadPlans();
  }, [reloadPlans]);

  const reloadOverview = useCallback(async () => {
    if (!planId) return setOverview(null);
    try {
      setOverview(await plansApi.overview(planId));
    } catch (e) {
      toast.error(msg(e));
    }
  }, [planId, toast]);
  useEffect(() => {
    void reloadOverview();
  }, [reloadOverview]);

  const reloadClasses = useCallback(async () => {
    if (!planId || !sectionId) return setClasses([]);
    try {
      setClasses(await plansApi.sectionClasses(planId, sectionId));
    } catch (e) {
      toast.error(msg(e));
    }
  }, [planId, sectionId, toast]);
  useEffect(() => {
    void reloadClasses();
  }, [reloadClasses]);

  // ── Plan lifecycle actions ────────────────────────────────────────────────
  async function run(action: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await action();
      toast.success(ok);
      await Promise.all([reloadPlans(), reloadOverview(), reloadClasses()]);
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function newPlan() {
    const name = window.prompt('New draft plan name', 'Draft Plan');
    if (!name) return;
    await run(async () => {
      const created = await plansApi.create({ semesterId, name });
      setPlanId(created.id);
    }, 'Plan created');
  }

  async function duplicate() {
    if (!plan) return;
    const name = window.prompt('Duplicate plan as', `Copy of ${plan.name}`);
    if (!name) return;
    await run(async () => {
      const copy = await plansApi.duplicate(plan.id, name);
      setPlanId(copy.id);
    }, 'Plan duplicated');
  }

  async function copyPreviousSemester() {
    const source = window.prompt('Source semester id to copy from', '');
    if (!source || !semesterId) return;
    await run(async () => {
      const copy = await plansApi.copySemester({
        sourceSemesterId: source,
        targetSemesterId: semesterId,
        name: 'Copied plan',
      });
      setPlanId(copy.id);
    }, 'Copied from previous semester');
  }

  const conflicts = overview?.validation.conflicts ?? [];
  const canPublish = overview?.validation.canPublish ?? false;

  // ── Class editing ─────────────────────────────────────────────────────────
  const classNumbers = useMemo(() => {
    const set = new Set<number>();
    for (const c of classes) if (c.scheduleType === scheduleType) set.add(c.classNumber);
    // Always show at least 8 class rows so an empty grid is still editable.
    for (let i = 1; i <= 8; i += 1) set.add(i);
    return [...set].sort((a, b) => a - b);
  }, [classes, scheduleType]);

  const cell = (day: DayOfWeek, n: number) =>
    classes.find(
      (c) => c.scheduleType === scheduleType && c.dayOfWeek === day && c.classNumber === n,
    );

  function openAdd(day: DayOfWeek, n: number) {
    if (!isDraft) return;
    // A period keeps the same clock across the week, so the times of any class already sitting in
    // this row are the right default — the school's bell, not an arbitrary 08:00.
    const sameRow = classes.find((c) => c.scheduleType === scheduleType && c.classNumber === n);
    setEditing({
      form: emptyClassForm(day, n, {
        startTime: sameRow?.startTime ?? DEFAULT_START,
        endTime: sameRow?.endTime ?? DEFAULT_END,
      }),
      id: null,
    });
  }
  function openEdit(c: EditableClass) {
    if (!isDraft) return;
    setEditing({
      id: c.id,
      form: {
        dayOfWeek: c.dayOfWeek,
        classNumber: String(c.classNumber),
        startTime: c.startTime,
        endTime: c.endTime,
        subjectId: c.subjectId,
        teacherId: c.teacherId ?? '',
        locationId: c.locationId ?? '',
      },
    });
  }

  async function saveClass() {
    if (!editing || !plan) return;
    const f = editing.form;
    if (!f.subjectId) return toast.error('Pick a subject');
    // The classroom is the grid itself, so it is only ever stated when the class is created —
    // the update endpoint has no `sectionId` and refuses a payload that carries one.
    const lesson: ClassUpdate = {
      scheduleType,
      dayOfWeek: f.dayOfWeek,
      classNumber: Number(f.classNumber),
      startTime: f.startTime,
      endTime: f.endTime,
      subjectId: f.subjectId,
      teacherId: f.teacherId || null,
      locationId: f.locationId || null,
    };
    setBusy(true);
    try {
      if (editing.id) await plansApi.updateClass(plan.id, editing.id, lesson);
      else await plansApi.addClass(plan.id, { sectionId, ...lesson });
      setEditing(null);
      await Promise.all([reloadClasses(), reloadOverview()]);
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteClass(id: string) {
    if (!plan) return;
    await run(() => plansApi.deleteClass(plan.id, id), 'Class removed');
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-5">
        <PageHeader
          title="Scheduling Workspace"
          align="center"
          actions={plan ? <Badge tone={STATUS_TONE[plan.status]}>{plan.status}</Badge> : null}
        />

        {/* Selectors */}
        <Card>
          <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Field label="School">
              <Select value={schoolId} onChange={(e) => cascade('school', e.target.value)}>
                <option value="">—</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nameEn}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Campus">
              <Select value={campusId} onChange={(e) => cascade('campus', e.target.value)}>
                <option value="">—</option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameEn}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Academic Year">
              <Select value={yearId} onChange={(e) => cascade('year', e.target.value)}>
                <option value="">—</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Semester">
              <Select value={semesterId} onChange={(e) => cascade('semester', e.target.value)}>
                <option value="">—</option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Schedule Plan">
              <Select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                disabled={!semesterId}
              >
                <option value="">—</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.status})
                  </option>
                ))}
              </Select>
            </Field>
          </CardContent>
        </Card>

        {/* Plan actions */}
        {semesterId ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void newPlan()} disabled={busy}>
              New Plan
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void copyPreviousSemester()}
              disabled={busy}
            >
              Copy Previous Semester
            </Button>
            {plan ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void duplicate()}
                  disabled={busy}
                >
                  Duplicate
                </Button>
                <Button
                  size="sm"
                  onClick={() => void run(() => plansApi.publish(plan.id), 'Published')}
                  disabled={busy || !isDraft || !canPublish}
                  title={!canPublish ? 'Resolve all conflicts to publish' : undefined}
                >
                  Publish
                </Button>
                {plan.status === 'ARCHIVED' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void run(() => plansApi.restore(plan.id), 'Restored to draft')}
                    disabled={busy}
                  >
                    Restore
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void run(() => plansApi.archive(plan.id), 'Archived')}
                    disabled={busy}
                  >
                    Archive
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (window.confirm('Delete this plan? This cannot be undone.'))
                      void run(async () => {
                        await plansApi.remove(plan.id);
                        setPlanId('');
                      }, 'Plan deleted');
                  }}
                  disabled={busy || plan.status === 'PUBLISHED'}
                >
                  Delete
                </Button>
              </>
            ) : null}
          </div>
        ) : null}

        {plan ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_18rem]">
            {/* Grid */}
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-end gap-2">
                  {/* A classroom is the grade + section pair — it is the students who stay put and
                      the teacher who moves, so the weekly grid is built per classroom. */}
                  <Field label="Classroom" className="min-w-[16rem] flex-1">
                    <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                      <option value="">Select a classroom…</option>
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {classroomLabel(s)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Schedule">
                    <Select
                      value={scheduleType}
                      onChange={(e) => setScheduleType(e.target.value as ScheduleType)}
                    >
                      <option value="REGULAR">Regular</option>
                      <option value="RAMADAN">Ramadan</option>
                    </Select>
                  </Field>
                  {isDraft && sectionId ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm('Clear this classroom in the current schedule?'))
                          void run(
                            () => plansApi.clearSection(plan.id, sectionId),
                            'Classroom cleared',
                          );
                      }}
                      disabled={busy}
                    >
                      Clear classroom
                    </Button>
                  ) : null}
                </div>

                {sectionId ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="border-b border-border p-2 text-start font-mono text-[10px] uppercase text-muted-foreground">
                            Class
                          </th>
                          {DAYS.map((d) => (
                            <th
                              key={d}
                              className="border-b border-border p-2 text-start font-display text-xs font-semibold"
                            >
                              {DAY_LABEL[d]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {classNumbers.map((n) => (
                          <tr key={n}>
                            <td className="whitespace-nowrap border-b border-border p-2 align-top font-mono text-[11px] text-muted-foreground">
                              Class {n}
                            </td>
                            {DAYS.map((d) => {
                              const c = cell(d, n);
                              return (
                                <td key={d} className="border-b border-border p-1 align-top">
                                  {c ? (
                                    <button
                                      type="button"
                                      onClick={() => openEdit(c)}
                                      className="w-full rounded-md p-1.5 text-start text-xs"
                                      style={{
                                        background: `${c.subjectColor}22`,
                                        borderInlineStart: `3px solid ${c.subjectColor}`,
                                      }}
                                    >
                                      <span className="block font-medium">{c.subjectName}</span>
                                      <span className="block text-[10px] text-muted-foreground">
                                        {c.startTime}–{c.endTime}
                                        {c.teacherName ? ` · ${c.teacherName}` : ' · no teacher'}
                                      </span>
                                      {c.locationName ? (
                                        <span className="block text-[10px] text-accent-cool">
                                          {c.locationName}
                                        </span>
                                      ) : null}
                                    </button>
                                  ) : isDraft ? (
                                    <button
                                      type="button"
                                      onClick={() => openAdd(d, n)}
                                      className="w-full rounded-md p-1.5 text-center text-xs text-muted-foreground hover:bg-accent"
                                    >
                                      +
                                    </button>
                                  ) : (
                                    <span className="block p-1.5 text-center text-xs text-muted-foreground">
                                      ·
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Select a classroom to view or edit its timetable.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Validation + legend panel */}
            <div className="space-y-4">
              <Card>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-sm font-semibold">Validation</h2>
                    <Badge tone={canPublish ? 'success' : 'danger'}>
                      {canPublish ? 'Ready' : 'Blocked'}
                    </Badge>
                  </div>
                  {conflicts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No conflicts detected.</p>
                  ) : (
                    <ul className="space-y-1">
                      {conflicts.map((c, i) => (
                        <li key={i} className="text-xs">
                          <Badge tone={c.severity === 'ERROR' ? 'danger' : 'warning'}>
                            {c.type}
                          </Badge>
                          <span className="ml-1 text-muted-foreground">{c.message}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-sm font-semibold">Subjects</h2>
                    <Link
                      href={subjectsHref}
                      className="text-xs font-medium text-primary-strong hover:underline"
                    >
                      Manage subjects →
                    </Link>
                  </div>
                  {subjects.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No subjects yet — add them first, then they become selectable on every class.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {subjects.map((s) => (
                        <span
                          key={s.id}
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
                          style={{ background: `${s.colorHex}22` }}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: s.colorHex }}
                          />
                          {s.nameEn}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : semesterId ? (
          <p className="text-sm text-muted-foreground">
            Select or create a schedule plan to begin.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Choose a school, campus, academic year and semester to load its schedule plans.
          </p>
        )}
      </div>

      {/* Class editor */}
      {editing ? (
        <Dialog
          open
          onClose={() => setEditing(null)}
          title={editing.id ? 'Edit class' : 'Add class'}
          description={`${DAY_LABEL[editing.form.dayOfWeek]} · Class ${editing.form.classNumber}`}
          footer={
            <div className="flex justify-between gap-2">
              {editing.id ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    const id = editing.id!;
                    setEditing(null);
                    void deleteClass(id);
                  }}
                >
                  Delete
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => void saveClass()} disabled={busy}>
                  Save
                </Button>
              </div>
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            {/* The square is the grid's to decide, not the dialog's: both adding and editing start
                from the cell that was clicked, so day and period are shown as what they are and a
                class can never be saved into a different square than the one it was opened from.
                A lesson moves by being removed from one cell and added to another. */}
            <Field label="Day">
              <Input value={DAY_LABEL[editing.form.dayOfWeek]} readOnly />
            </Field>
            <Field label="Class number">
              <Input value={editing.form.classNumber} readOnly />
            </Field>
            <Field label="Start">
              <TimeCounter
                value={editing.form.startTime}
                onChange={(value) => setForm({ startTime: value, endTime: endFor(value) })}
              />
            </Field>
            <Field label="End">
              <TimeCounter
                value={editing.form.endTime}
                onChange={(value) => setForm({ endTime: value })}
              />
            </Field>
            <Field label="Subject" className="col-span-2">
              <Select
                value={editing.form.subjectId}
                onChange={(e) => setForm({ subjectId: e.target.value })}
              >
                <option value="">—</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nameEn}
                  </option>
                ))}
              </Select>
              {subjects.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  No subjects defined yet —{' '}
                  <Link href={subjectsHref} className="text-primary-strong hover:underline">
                    add them here
                  </Link>
                  .
                </p>
              ) : null}
            </Field>
            <Field label="Teacher" className="col-span-2">
              <Select
                value={editing.form.teacherId}
                onChange={(e) => setForm({ teacherId: e.target.value })}
              >
                <option value="">— unassigned —</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.firstNameEn} {t.lastNameEn}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Dialog>
      ) : null}
    </Shell>
  );

  // Reset dependent selectors when a parent changes.
  function cascade(level: 'school' | 'campus' | 'year' | 'semester', value: string) {
    if (level === 'school') {
      setSchoolId(value);
      setCampusId('');
      setYearId('');
      setSemesterId('');
      setPlanId('');
    } else if (level === 'campus') {
      setCampusId(value);
      setYearId('');
      setSemesterId('');
      setPlanId('');
    } else if (level === 'year') {
      setYearId(value);
      setSemesterId('');
      setPlanId('');
    } else {
      setSemesterId(value);
      setPlanId('');
    }
  }

  function setForm(patch: Partial<ClassForm>) {
    setEditing((cur) => (cur ? { ...cur, form: { ...cur.form, ...patch } } : cur));
  }

  /** Counting the start up or down drags the end with it, so the lesson keeps its length. */
  function endFor(nextStart: string): string {
    if (!editing) return nextStart;
    const length = minutesBetween(editing.form.startTime, editing.form.endTime);
    return length > 0 ? shiftTime(nextStart, length) : editing.form.endTime;
  }
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'Request failed';
}
