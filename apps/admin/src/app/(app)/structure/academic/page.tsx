'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import { useConfirm } from '@/components/confirm';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  useToast,
} from '@axa/platform';
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
        <h1 className="font-display text-2xl font-semibold">{t('nav.academicStructure')}</h1>

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
          <>
            <Grades campusId={campusId} />
            <Classrooms campusId={campusId} />
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

// --------------------------------------------------------------------------- Grades + Sections

function Grades({ campusId }: { campusId: string }) {
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
                  {openGrade === g.id ? <Sections gradeId={g.id} /> : null}
                </TD>
                <TD className="text-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpenGrade(openGrade === g.id ? null : g.id)}
                  >
                    {openGrade === g.id ? t('structure.hideSections') : t('structure.sections')}
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

function Sections({ gradeId }: { gradeId: string }) {
  const onErr = useError();
  const { t } = useI18n();
  const confirm = useConfirm();
  const [sections, setSections] = useState<Section[]>([]);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');

  const load = useCallback(() => {
    sectionsApi
      .list(gradeId)
      .then(setSections)
      .catch((e) => onErr(e, 'Failed to load sections'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeId]);

  useEffect(() => load(), [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload: { gradeId: string; name: string; capacity?: number } = { gradeId, name };
      if (capacity) payload.capacity = Number(capacity);
      await sectionsApi.create(payload);
      setName('');
      setCapacity('');
      load();
    } catch (e) {
      onErr(e, 'Create failed');
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-border bg-background/40 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {sections.map((s) => (
          <Badge key={s.id} tone="muted">
            {s.name}
            {s.capacity ? ` · ${s.capacity}` : ''}
            <button
              type="button"
              className="ms-1 text-muted-foreground hover:text-destructive"
              onClick={() =>
                void confirm().then((ok) => {
                  if (ok)
                    void sectionsApi
                      .remove(s.id)
                      .then(load)
                      .catch((e) => onErr(e, 'Delete failed'));
                })
              }
              aria-label={`Delete section ${s.name}`}
            >
              ✕
            </button>
          </Badge>
        ))}
        {sections.length === 0 ? (
          <span className="text-xs text-muted-foreground">{t('structure.noSections')}</span>
        ) : null}
      </div>
      <form onSubmit={(e) => void create(e)} className="flex items-end gap-2">
        <Input
          className="h-8 w-28"
          placeholder={t('structure.sectionPlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          className="h-8 w-24"
          type="number"
          placeholder={t('structure.capacity')}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
        />
        <Button type="submit" size="sm">
          {t('structure.addSection')}
        </Button>
      </form>
    </div>
  );
}

// --------------------------------------------------------------------------- Classrooms

function Classrooms({ campusId }: { campusId: string }) {
  const onErr = useError();
  const toast = useToast();
  const { t } = useI18n();
  const confirm = useConfirm();
  const [rooms, setRooms] = useState<Classroom[]>([]);
  const [form, setForm] = useState({ name: '', capacity: '', building: '', floor: '' });

  const load = useCallback(() => {
    classroomsApi
      .list(campusId)
      .then(setRooms)
      .catch((e) => onErr(e, 'Failed to load classrooms'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusId]);

  useEffect(() => load(), [load]);

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
      toast.success('Classroom added');
      load();
    } catch (e) {
      onErr(e, 'Create failed');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('structure.classrooms')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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
                            .then(load)
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
                  <EmptyState title={t('structure.noClassrooms')} />
                </TD>
              </TR>
            ) : null}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}
