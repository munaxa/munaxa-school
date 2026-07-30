'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import { useConfirm } from '@/components/confirm';
import { StatusBadge } from '@/components/status-badge';
import {
  EMPLOYMENT_STATUSES,
  teachersApi,
  type CreateTeacherInput,
  type Teacher,
} from '@/lib/people';
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
} from '@axa/platform';

const EMPTY: CreateTeacherInput = {
  firstNameEn: '',
  lastNameEn: '',
  firstNameAr: '',
  lastNameAr: '',
  employeeNumber: '',
  specialization: '',
  status: 'ACTIVE',
};

export default function TeachersPage() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setTeachers(await teachersApi.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load teachers');
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
      await teachersApi.remove(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  if (loading) {
    return (
      <Shell>
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader title={t('nav.teachers')} />
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t('people.addTeacher')}</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateTeacher onCreated={load} onError={setError} />
          </CardContent>
        </Card>

        <Table>
          <THead>
            <TR>
              <TH>{t('common.name')}</TH>
              <TH>{t('common.arabicName')}</TH>
              <TH>{t('people.employeeNumber')}</TH>
              <TH>{t('people.specialization')}</TH>
              <TH>{t('common.status')}</TH>
              <TH className="text-end">{t('common.actions')}</TH>
            </TR>
          </THead>
          <TBody>
            {teachers.map((tch) => (
              <TR key={tch.id}>
                <TD>
                  {tch.firstNameEn} {tch.lastNameEn}
                </TD>
                <TD dir="rtl">
                  {tch.firstNameAr} {tch.lastNameAr}
                </TD>
                <TD className="font-mono text-xs text-muted-foreground">
                  {tch.employeeNumber || '—'}
                </TD>
                <TD>{tch.specialization || '—'}</TD>
                <TD>
                  <StatusBadge status={tch.status} />
                </TD>
                <TD className="text-end">
                  <Button variant="ghost" size="sm" onClick={() => void remove(tch.id)}>
                    {t('common.delete')}
                  </Button>
                </TD>
              </TR>
            ))}
            {teachers.length === 0 ? (
              <TR>
                <TD colSpan={6}>
                  <EmptyState title={t('people.noTeachers')} />
                </TD>
              </TR>
            ) : null}
          </TBody>
        </Table>
      </div>
    </Shell>
  );
}

function CreateTeacher({
  onCreated,
  onError,
}: {
  onCreated: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState<CreateTeacherInput>(EMPTY);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof CreateTeacherInput>(key: K, value: CreateTeacherInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: CreateTeacherInput = {
        firstNameEn: form.firstNameEn,
        lastNameEn: form.lastNameEn,
        firstNameAr: form.firstNameAr,
        lastNameAr: form.lastNameAr,
        status: form.status ?? 'ACTIVE',
      };
      if (form.employeeNumber) payload.employeeNumber = form.employeeNumber;
      if (form.specialization) payload.specialization = form.specialization;
      await teachersApi.create(payload);
      setForm(EMPTY);
      await onCreated();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-2 sm:grid-cols-2">
      <Field label={t('common.firstNameEn')} htmlFor="teacher-firstNameEn">
        <Input
          id="teacher-firstNameEn"
          placeholder={t('common.firstNameEn')}
          value={form.firstNameEn}
          onChange={(e) => set('firstNameEn', e.target.value)}
          required
        />
      </Field>
      <Field label={t('common.lastNameEn')} htmlFor="teacher-lastNameEn">
        <Input
          id="teacher-lastNameEn"
          placeholder={t('common.lastNameEn')}
          value={form.lastNameEn}
          onChange={(e) => set('lastNameEn', e.target.value)}
          required
        />
      </Field>
      <Field label="الاسم (AR)" htmlFor="teacher-firstNameAr">
        <Input
          id="teacher-firstNameAr"
          placeholder="الاسم (AR)"
          value={form.firstNameAr}
          onChange={(e) => set('firstNameAr', e.target.value)}
          required
          dir="rtl"
        />
      </Field>
      <Field label="العائلة (AR)" htmlFor="teacher-lastNameAr">
        <Input
          id="teacher-lastNameAr"
          placeholder="العائلة (AR)"
          value={form.lastNameAr}
          onChange={(e) => set('lastNameAr', e.target.value)}
          required
          dir="rtl"
        />
      </Field>
      <Field label={t('people.employeeNumberPlaceholder')} htmlFor="teacher-employeeNumber">
        <Input
          id="teacher-employeeNumber"
          placeholder={t('people.employeeNumberPlaceholder')}
          value={form.employeeNumber ?? ''}
          onChange={(e) => set('employeeNumber', e.target.value)}
        />
      </Field>
      <Field label={t('people.specializationPlaceholder')} htmlFor="teacher-specialization">
        <Input
          id="teacher-specialization"
          placeholder={t('people.specializationPlaceholder')}
          value={form.specialization ?? ''}
          onChange={(e) => set('specialization', e.target.value)}
        />
      </Field>
      <Field label={t('common.status')} htmlFor="teacher-status">
        <Select
          id="teacher-status"
          value={form.status ?? 'ACTIVE'}
          onChange={(e) => set('status', e.target.value as CreateTeacherInput['status'])}
        >
          {EMPLOYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" className="sm:col-span-2" disabled={busy}>
        {busy ? t('common.adding') : t('people.addTeacherButton')}
      </Button>
    </form>
  );
}
