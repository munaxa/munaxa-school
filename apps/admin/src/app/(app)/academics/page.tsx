'use client';

import { useState } from 'react';
import { Shell } from '@/components/shell';
import {
  academicsApi,
  BEHAVIOR_TYPES,
  type BehaviorLog,
  type BehaviorType,
  type CreateBehaviorInput,
  type GradeReport,
  type Homework,
} from '@/lib/academics';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DatePicker,
  EmptyState,
  EntityPicker,
  Field,
  Input,
  PageHeader,
  Select,
  Table,
  TBody,
  TD,
  Textarea,
  TH,
  THead,
  TR,
  useToast,
} from '@axa/platform';
import { useI18n } from '@/components/i18n-provider';
import { useConfirm } from '@/components/confirm';
import { loadSectionOptions, loadStudentOptions } from '@/lib/pickers';

export default function AcademicsPage() {
  const { t } = useI18n();
  return (
    <Shell>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title={t('nav.academics')} />
        <HomeworkSection />
        <GradesSection />
        <BehaviorSection />
      </div>
    </Shell>
  );
}

function HomeworkSection() {
  const toast = useToast();
  const { t } = useI18n();
  const [sectionId, setSectionId] = useState('');
  const [list, setList] = useState<Homework[]>([]);
  const [form, setForm] = useState({ subject: '', title: '', dueDate: '' });

  async function load() {
    if (!sectionId) return;
    try {
      setList(await academicsApi.homeworkBySection(sectionId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load homework');
    }
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await academicsApi.createHomework({ sectionId, ...form });
      setForm({ subject: '', title: '', dueDate: '' });
      toast.success('Homework added');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add homework');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('academics.homework')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-2">
          <Field label={t('academics.section')} className="flex-1">
            <EntityPicker
              value={sectionId}
              onChange={setSectionId}
              load={loadSectionOptions}
              placeholder={t('academics.searchSections')}
            />
          </Field>
          <Button variant="secondary" onClick={() => void load()}>
            {t('common.load')}
          </Button>
        </div>
        <form onSubmit={(e) => void create(e)} className="flex flex-wrap items-end gap-2">
          <Field label={t('academics.subject')} className="flex-1">
            <Input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              required
            />
          </Field>
          <Field label={t('academics.title')} className="flex-1">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </Field>
          <Field label={t('academics.due')}>
            <DatePicker
              value={form.dueDate}
              onChange={(value) => setForm({ ...form, dueDate: value })}
              required
            />
          </Field>
          <Button type="submit" disabled={!sectionId}>
            {t('common.add')}
          </Button>
        </form>
        <Table>
          <THead>
            <TR>
              <TH>{t('academics.subject')}</TH>
              <TH>{t('academics.title')}</TH>
              <TH className="text-end">{t('academics.due')}</TH>
            </TR>
          </THead>
          <TBody>
            {list.map((h) => (
              <TR key={h.id}>
                <TD>{h.subject}</TD>
                <TD>{h.title}</TD>
                <TD className="text-end font-mono text-xs text-muted-foreground">
                  {h.dueDate.slice(0, 10)}
                </TD>
              </TR>
            ))}
            {list.length === 0 ? (
              <TR>
                <TD colSpan={3}>
                  <EmptyState title={t('academics.noHomework')} />
                </TD>
              </TR>
            ) : null}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function GradesSection() {
  const toast = useToast();
  const { t } = useI18n();
  const [csv, setCsv] = useState('studentId,subject,assessment,score,maxScore\n');
  const [studentId, setStudentId] = useState('');
  const [report, setReport] = useState<GradeReport | null>(null);

  async function importCsv(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await academicsApi.importGrades(csv);
      toast.success(`Imported ${r.imported}; ${r.failed.length} failed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    }
  }
  async function loadReport() {
    if (!studentId) return;
    try {
      setReport(await academicsApi.gradeReport(studentId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load report');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('academics.grades')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={(e) => void importCsv(e)} className="space-y-2">
          <Field label={t('academics.importCsv')}>
            <Textarea
              className="h-24 font-mono text-xs"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
            />
          </Field>
          <Button type="submit" variant="secondary">
            {t('academics.importGradesCsv')}
          </Button>
        </form>
        <div className="flex items-end gap-2">
          <Field label={t('academics.student')} className="flex-1">
            <EntityPicker
              value={studentId}
              onChange={setStudentId}
              load={loadStudentOptions}
              placeholder={t('academics.searchStudents')}
            />
          </Field>
          <Button onClick={() => void loadReport()}>{t('academics.report')}</Button>
        </div>
        {report ? (
          <div className="space-y-2">
            <Badge tone="default">
              {t('academics.overall')} {report.overallPercent}%
            </Badge>
            <div className="space-y-1 text-sm text-muted-foreground">
              {report.subjects.map((s) => (
                <p key={s.subject}>
                  {s.subject}: {s.averagePercent}% ({s.count})
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

const BEHAVIOR_TONE: Record<BehaviorType, 'success' | 'danger' | 'muted'> = {
  POSITIVE: 'success',
  NEGATIVE: 'danger',
  NEUTRAL: 'muted',
};

const EMPTY_BEHAVIOR = {
  type: 'POSITIVE' as BehaviorType,
  category: '',
  title: '',
  description: '',
  points: '0',
  date: '',
};

function BehaviorSection() {
  const toast = useToast();
  const { t } = useI18n();
  const confirm = useConfirm();
  const [studentId, setStudentId] = useState('');
  const [list, setList] = useState<BehaviorLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState(EMPTY_BEHAVIOR);

  async function load(id = studentId) {
    if (!id) return;
    try {
      setList(await academicsApi.behaviorByStudent(id));
      setLoaded(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load behavior');
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId) {
      toast.error('Select a student first');
      return;
    }
    try {
      const payload: CreateBehaviorInput = {
        studentId,
        type: form.type,
        title: form.title,
        points: Number(form.points) || 0,
        date: form.date,
      };
      if (form.category) payload.category = form.category;
      if (form.description) payload.description = form.description;
      await academicsApi.createBehavior(payload);
      setForm(EMPTY_BEHAVIOR);
      toast.success('Behavior logged');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to log behavior');
    }
  }

  async function remove(id: string) {
    if (!(await confirm())) return;
    try {
      await academicsApi.removeBehavior(id);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('academics.behavior')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-2">
          <Field label={t('academics.student')} className="flex-1">
            <EntityPicker
              value={studentId}
              onChange={(id) => {
                setStudentId(id);
                void load(id);
              }}
              load={loadStudentOptions}
              placeholder={t('academics.searchStudents')}
            />
          </Field>
          <Button variant="secondary" onClick={() => void load()} disabled={!studentId}>
            {t('common.load')}
          </Button>
        </div>

        <form onSubmit={(e) => void create(e)} className="flex flex-wrap items-end gap-2">
          <Field label={t('academics.type')}>
            <Select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as BehaviorType })}
            >
              {BEHAVIOR_TYPES.map((bt) => (
                <option key={bt} value={bt}>
                  {bt}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('academics.title')} className="flex-1">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </Field>
          <Field label={t('academics.category')}>
            <Input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </Field>
          <Field label={t('academics.points')}>
            <Input
              type="number"
              min={-100}
              max={100}
              value={form.points}
              onChange={(e) => setForm({ ...form, points: e.target.value })}
            />
          </Field>
          <Field label={t('academics.date')}>
            <DatePicker
              value={form.date}
              onChange={(value) => setForm({ ...form, date: value })}
              required
            />
          </Field>
          <Button type="submit" disabled={!studentId}>
            {t('common.add')}
          </Button>
        </form>

        {loaded ? (
          <Table>
            <THead>
              <TR>
                <TH>{t('academics.date')}</TH>
                <TH>{t('academics.type')}</TH>
                <TH>{t('academics.title')}</TH>
                <TH className="text-end">{t('academics.points')}</TH>
                <TH className="text-end">{t('common.actions')}</TH>
              </TR>
            </THead>
            <TBody>
              {list.map((b) => (
                <TR key={b.id}>
                  <TD className="font-mono text-xs">{b.date.slice(0, 10)}</TD>
                  <TD>
                    <Badge tone={BEHAVIOR_TONE[b.type]}>{b.type}</Badge>
                  </TD>
                  <TD>
                    {b.title}
                    {b.category ? (
                      <span className="text-muted-foreground"> · {b.category}</span>
                    ) : null}
                  </TD>
                  <TD className="text-end font-mono text-xs">{b.points}</TD>
                  <TD className="text-end">
                    <Button variant="ghost" size="sm" onClick={() => void remove(b.id)}>
                      {t('common.delete')}
                    </Button>
                  </TD>
                </TR>
              ))}
              {list.length === 0 ? (
                <TR>
                  <TD colSpan={5}>
                    <EmptyState title={t('academics.noBehavior')} />
                  </TD>
                </TR>
              ) : null}
            </TBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  );
}
