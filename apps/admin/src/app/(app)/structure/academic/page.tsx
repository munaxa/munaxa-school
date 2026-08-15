'use client';

import { useCallback, useEffect, useState } from 'react';
import { classroomLabel } from '@school/domain';
import { Shell } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import { useConfirm } from '@/components/confirm';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  useToast,
} from '@munaxa/ui';
import {
  campusesApi,
  classroomsApi,
  gradesApi,
  schoolsApi,
  sectionsApi,
  type Campus,
  type Classroom,
  type Grade,
  type School,
  type Section,
} from '@/lib/structure';

export default function AcademicStructurePage() {
  const { t } = useI18n();
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusId, setCampusId] = useState('');
  const toast = useToast();

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
      .then(setCampuses)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load campuses'));
  }, [schoolId, toast]);

  return (
    <Shell>
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader title={t('nav.academicStructure')} />

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
          <CampusStructure campusId={campusId} />
        ) : (
          <p className="text-sm text-muted-foreground">{t('structure.emptyHint')}</p>
        )}
      </div>
    </Shell>
  );
}

function useError() {
  const toast = useToast();
  return (e: unknown, fallback: string) => toast.error(e instanceof Error ? e.message : fallback);
}

/**
 * The campus's academic structure. Rooms are loaded once here and shared with the grades card, so
 * a room added below is immediately assignable to a classroom above.
 */
function CampusStructure({ campusId }: { campusId: string }) {
  const onErr = useError();
  const { t } = useI18n();
  const [rooms, setRooms] = useState<Classroom[]>([]);

  const loadRooms = useCallback(() => {
    classroomsApi
      .list(campusId)
      .then(setRooms)
      .catch((e) => onErr(e, 'Failed to load rooms'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusId]);

  useEffect(() => loadRooms(), [loadRooms]);

  return (
    <>
      <Grades campusId={campusId} rooms={rooms} />
      <Rooms campusId={campusId} rooms={rooms} reload={loadRooms} />
      <Card>
        <CardHeader>
          <CardTitle>{t('structure.academicYears')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('academicYear.subtitle')}</p>
          <a
            href="/structure/academic-year"
            className="mt-3 inline-flex items-center text-sm font-medium text-primary-strong hover:underline"
          >
            {t('academicYear.title')} →
          </a>
        </CardContent>
      </Card>
    </>
  );
}

// --------------------------------------------------------------------------- Grades + classrooms

function Grades({ campusId, rooms }: { campusId: string; rooms: Classroom[] }) {
  const onErr = useError();
  const toast = useToast();
  const { t } = useI18n();
  const confirm = useConfirm();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [form, setForm] = useState({ nameEn: '', nameAr: '', level: '' });
  const [openGrade, setOpenGrade] = useState<string | null>(null);

  const load = useCallback(() => {
    gradesApi
      .list(campusId)
      .then(setGrades)
      .catch((e) => onErr(e, 'Failed to load grades'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusId]);

  useEffect(() => load(), [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await gradesApi.create({
        campusId,
        nameEn: form.nameEn,
        nameAr: form.nameAr,
        level: Number(form.level) || 0,
      });
      setForm({ nameEn: '', nameAr: '', level: '' });
      toast.success('Grade added');
      load();
    } catch (e) {
      onErr(e, 'Create failed');
    }
  }

  async function remove(id: string) {
    if (!(await confirm())) return;
    try {
      await gradesApi.remove(id);
      load();
    } catch (e) {
      onErr(e, 'Delete failed');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('structure.grades')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={(e) => void create(e)} className="flex flex-wrap items-end gap-2">
          <Field label={t('structure.nameEn')} className="flex-1">
            <Input
              value={form.nameEn}
              onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
              required
            />
          </Field>
          <Field label={t('structure.nameAr')} className="flex-1">
            <Input
              value={form.nameAr}
              onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
              required
              dir="rtl"
            />
          </Field>
          <Field label={t('structure.level')}>
            <Input
              type="number"
              className="w-20"
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
              required
            />
          </Field>
          <Button type="submit">{t('common.add')}</Button>
        </form>

        <Table>
          <THead>
            <TR>
              <TH className="w-16">{t('structure.level')}</TH>
              <TH>{t('structure.name')}</TH>
              <TH className="text-end">{t('common.actions')}</TH>
            </TR>
          </THead>
          <TBody>
            {grades.map((g) => (
              <TR key={g.id}>
                <TD className="font-mono text-xs">{g.level}</TD>
                <TD>
                  {g.nameEn}{' '}
                  <span className="text-muted-foreground" dir="rtl">
                    · {g.nameAr}
                  </span>
                  {openGrade === g.id ? <Classrooms gradeId={g.id} rooms={rooms} /> : null}
                </TD>
                <TD className="text-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpenGrade(openGrade === g.id ? null : g.id)}
                  >
                    {openGrade === g.id ? t('structure.hideClassrooms') : t('structure.classrooms')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void remove(g.id)}>
                    {t('common.delete')}
                  </Button>
                </TD>
              </TR>
            ))}
            {grades.length === 0 ? (
              <TR>
                <TD colSpan={3}>
                  <EmptyState title={t('structure.noGrades')} />
                </TD>
              </TR>
            ) : null}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/**
 * The classrooms of one grade. A classroom *is* the grade + section pair ("Grade 6 · B"): students
 * stay in it and teachers come to them, so it is the unit rosters, timetables and attendance are
 * built on. The room below it is only the space it occupies, and is optional.
 */
function Classrooms({ gradeId, rooms }: { gradeId: string; rooms: Classroom[] }) {
  const onErr = useError();
  const toast = useToast();
  const { t, locale } = useI18n();
  const confirm = useConfirm();
  const [classrooms, setClassrooms] = useState<Section[]>([]);
  const [form, setForm] = useState({ name: '', classroomId: '', capacity: '' });

  const load = useCallback(() => {
    sectionsApi
      .list(gradeId)
      .then(setClassrooms)
      .catch((e) => onErr(e, 'Failed to load classrooms'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeId]);

  useEffect(() => load(), [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload: { gradeId: string; name: string; classroomId?: string; capacity?: number } = {
        gradeId,
        name: form.name,
      };
      if (form.classroomId) payload.classroomId = form.classroomId;
      if (form.capacity) payload.capacity = Number(form.capacity);
      await sectionsApi.create(payload);
      setForm({ name: '', classroomId: '', capacity: '' });
      load();
    } catch (e) {
      onErr(e, 'Create failed');
    }
  }

  /** Assigning (or clearing) the room a classroom sits in — saved on change. */
  async function assignRoom(id: string, classroomId: string) {
    try {
      await sectionsApi.update(id, { classroomId: classroomId || null });
      toast.success(t('structure.classroomUpdated'));
      load();
    } catch (e) {
      onErr(e, 'Update failed');
    }
  }

  async function remove(id: string) {
    if (!(await confirm())) return;
    try {
      await sectionsApi.remove(id);
      load();
    } catch (e) {
      onErr(e, 'Delete failed');
    }
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border bg-background/40 p-3">
      <p className="text-xs text-muted-foreground">{t('structure.classroomHint')}</p>

      <Table>
        <THead>
          <TR>
            <TH>{t('structure.classroom')}</TH>
            <TH>{t('structure.room')}</TH>
            <TH className="text-end">{t('structure.capacity')}</TH>
            <TH className="text-end">{t('common.actions')}</TH>
          </TR>
        </THead>
        <TBody>
          {classrooms.map((c) => (
            <TR key={c.id}>
              <TD className="font-medium">{classroomLabel(c, locale)}</TD>
              <TD>
                <Select
                  className="h-8 w-36"
                  value={c.classroomId ?? ''}
                  onChange={(e) => void assignRoom(c.id, e.target.value)}
                  aria-label={`${t('structure.room')} — ${classroomLabel(c, locale)}`}
                >
                  <option value="">{t('structure.noRoom')}</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </TD>
              <TD className="text-end font-mono text-xs">{c.capacity ?? '—'}</TD>
              <TD className="text-end">
                <Button variant="ghost" size="sm" onClick={() => void remove(c.id)}>
                  {t('common.delete')}
                </Button>
              </TD>
            </TR>
          ))}
          {classrooms.length === 0 ? (
            <TR>
              <TD colSpan={4}>
                <EmptyState title={t('structure.noClassrooms')} />
              </TD>
            </TR>
          ) : null}
        </TBody>
      </Table>

      <form onSubmit={(e) => void create(e)} className="flex flex-wrap items-end gap-2">
        <Input
          className="h-8 w-28"
          placeholder={t('structure.classroomPlaceholder')}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <Select
          className="h-8 w-36"
          value={form.classroomId}
          onChange={(e) => setForm({ ...form, classroomId: e.target.value })}
          aria-label={t('structure.room')}
        >
          <option value="">{t('structure.noRoom')}</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
        <Input
          className="h-8 w-24"
          type="number"
          placeholder={t('structure.capacity')}
          value={form.capacity}
          onChange={(e) => setForm({ ...form, capacity: e.target.value })}
        />
        <Button type="submit" size="sm">
          {t('structure.addClassroom')}
        </Button>
      </form>
    </div>
  );
}

// --------------------------------------------------------------------------- Rooms

/** Physical rooms on the campus. A classroom may be assigned one; lessons without a location of
 *  their own happen there, since it is the teacher who moves between classrooms, not the students. */
function Rooms({
  campusId,
  rooms,
  reload,
}: {
  campusId: string;
  rooms: Classroom[];
  reload: () => void;
}) {
  const onErr = useError();
  const toast = useToast();
  const { t } = useI18n();
  const confirm = useConfirm();
  const [form, setForm] = useState({ name: '', capacity: '', building: '', floor: '' });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload: {
        campusId: string;
        name: string;
        capacity?: number;
        building?: string;
        floor?: string;
      } = {
        campusId,
        name: form.name,
      };
      if (form.capacity) payload.capacity = Number(form.capacity);
      if (form.building) payload.building = form.building;
      if (form.floor) payload.floor = form.floor;
      await classroomsApi.create(payload);
      setForm({ name: '', capacity: '', building: '', floor: '' });
      toast.success('Room added');
      reload();
    } catch (e) {
      onErr(e, 'Create failed');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('structure.rooms')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('structure.roomsHint')}</p>
        <form onSubmit={(e) => void create(e)} className="flex flex-wrap items-end gap-2">
          <Field label={t('structure.name')} className="flex-1">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <Field label={t('structure.capacity')}>
            <Input
              type="number"
              className="w-24"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            />
          </Field>
          <Field label={t('structure.building')}>
            <Input
              className="w-28"
              value={form.building}
              onChange={(e) => setForm({ ...form, building: e.target.value })}
            />
          </Field>
          <Field label={t('structure.floor')}>
            <Input
              className="w-20"
              value={form.floor}
              onChange={(e) => setForm({ ...form, floor: e.target.value })}
            />
          </Field>
          <Button type="submit">{t('common.add')}</Button>
        </form>

        <Table>
          <THead>
            <TR>
              <TH>{t('structure.name')}</TH>
              <TH>{t('structure.building')}</TH>
              <TH>{t('structure.floor')}</TH>
              <TH className="text-end">{t('structure.capacity')}</TH>
              <TH className="text-end">{t('common.actions')}</TH>
            </TR>
          </THead>
          <TBody>
            {rooms.map((r) => (
              <TR key={r.id}>
                <TD>{r.name}</TD>
                <TD>{r.building || '—'}</TD>
                <TD>{r.floor || '—'}</TD>
                <TD className="text-end font-mono text-xs">{r.capacity ?? '—'}</TD>
                <TD className="text-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      void confirm().then((ok) => {
                        if (ok)
                          void classroomsApi
                            .remove(r.id)
                            .then(reload)
                            .catch((e) => onErr(e, 'Delete failed'));
                      })
                    }
                  >
                    {t('common.delete')}
                  </Button>
                </TD>
              </TR>
            ))}
            {rooms.length === 0 ? (
              <TR>
                <TD colSpan={5}>
                  <EmptyState title={t('structure.noRooms')} />
                </TD>
              </TR>
            ) : null}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}
