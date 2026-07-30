'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Shell } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  EntityPicker,
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
  type PickerOption,
} from '@axa/platform';
import { loadStudentOptions } from '@/lib/pickers';
import {
  CLINIC_OUTCOMES,
  clinicApi,
  type ClinicOutcome,
  type ClinicVisit,
  type CreateVisitInput,
  type MedicalRecord,
} from '@/lib/advanced';
import { ClinicOutcomeBadge } from '@/components/domain';

export default function ClinicPage() {
  const { t } = useI18n();
  const [visits, setVisits] = useState<ClinicVisit[]>([]);
  const [students, setStudents] = useState<PickerOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setVisits(await clinicApi.visits());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load clinic visits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // Student names are best-effort: clinic staff may lack the student:list permission.
    loadStudentOptions()
      .then(setStudents)
      .catch(() => undefined);
  }, [load]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of students) map.set(s.id, s.label);
    return map;
  }, [students]);

  if (loading) {
    return (
      <Shell>
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title={t('nav.clinic')} />
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('clinic.recordVisit')}</CardTitle>
            </CardHeader>
            <CardContent>
              <CreateVisit onDone={load} onError={setError} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('clinic.medicalRecord')}</CardTitle>
            </CardHeader>
            <CardContent>
              <RecordEditor onError={setError} />
            </CardContent>
          </Card>
        </div>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-medium">{t('clinic.recentVisits')}</h2>
          <Table>
            <THead>
              <TR>
                <TH>{t('clinic.student')}</TH>
                <TH>{t('clinic.reason')}</TH>
                <TH>{t('clinic.temp')}</TH>
                <TH>{t('clinic.outcome')}</TH>
                <TH>{t('clinic.date')}</TH>
              </TR>
            </THead>
            <TBody>
              {visits.map((v) => (
                <TR key={v.id}>
                  <TD>{nameById.get(v.studentId) ?? `${v.studentId.slice(0, 8)}…`}</TD>
                  <TD>{v.reason}</TD>
                  <TD className="font-mono text-xs">
                    {v.temperature != null ? `${String(v.temperature)}°` : '—'}
                  </TD>
                  <TD>
                    <ClinicOutcomeBadge outcome={v.outcome} />
                  </TD>
                  <TD className="font-mono text-xs">{v.visitedAt.slice(0, 10)}</TD>
                </TR>
              ))}
              {visits.length === 0 ? (
                <TR>
                  <TD colSpan={5}>
                    <EmptyState title={t('clinic.noVisits')} />
                  </TD>
                </TR>
              ) : null}
            </TBody>
          </Table>
        </section>
      </div>
    </Shell>
  );
}

function CreateVisit({
  onDone,
  onError,
}: {
  onDone: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const { t } = useI18n();
  const [studentId, setStudentId] = useState('');
  const [reason, setReason] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [treatment, setTreatment] = useState('');
  const [temperature, setTemperature] = useState('');
  const [outcome, setOutcome] = useState<ClinicOutcome>('RESOLVED');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId) {
      onError('Select a student first');
      return;
    }
    setBusy(true);
    try {
      const payload: CreateVisitInput = { studentId, reason, outcome };
      if (symptoms) payload.symptoms = symptoms;
      if (treatment) payload.treatment = treatment;
      if (temperature) payload.temperature = Number(temperature);
      await clinicApi.createVisit(payload);
      setStudentId('');
      setReason('');
      setSymptoms('');
      setTreatment('');
      setTemperature('');
      setOutcome('RESOLVED');
      await onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Record failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-2">
      <Field label={t('clinic.student')}>
        <EntityPicker value={studentId} onChange={setStudentId} load={loadStudentOptions} />
      </Field>
      <Field label={t('clinic.reason')} htmlFor="visit-reason">
        <Input
          id="visit-reason"
          placeholder={t('clinic.reason')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        />
      </Field>
      <Field label={t('clinic.symptoms')} htmlFor="visit-symptoms">
        <Input
          id="visit-symptoms"
          placeholder={t('clinic.symptoms')}
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
        />
      </Field>
      <Field label={t('clinic.treatment')} htmlFor="visit-treatment">
        <Input
          id="visit-treatment"
          placeholder={t('clinic.treatment')}
          value={treatment}
          onChange={(e) => setTreatment(e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t('clinic.tempC')} htmlFor="visit-temp">
          <Input
            id="visit-temp"
            type="number"
            step="0.1"
            min={30}
            max={45}
            placeholder={t('clinic.tempC')}
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            dir="ltr"
          />
        </Field>
        <Field label={t('clinic.outcome')} htmlFor="visit-outcome">
          <Select
            id="visit-outcome"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as ClinicOutcome)}
          >
            {CLINIC_OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {o.replace('_', ' ')}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? t('clinic.recording') : t('clinic.recordVisitBtn')}
      </Button>
    </form>
  );
}

const EMPTY_RECORD: MedicalRecord = {
  bloodType: '',
  allergies: '',
  chronicConditions: '',
  medications: '',
  emergencyContact: '',
  notes: '',
};

function RecordEditor({ onError }: { onError: (m: string) => void }) {
  const { t } = useI18n();
  const [studentId, setStudentId] = useState('');
  const [record, setRecord] = useState<MedicalRecord>(EMPTY_RECORD);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  async function loadRecord(id: string) {
    setStudentId(id);
    setLoaded(false);
    if (!id) return;
    try {
      const rec = await clinicApi.getRecord(id);
      setRecord(rec ?? EMPTY_RECORD);
      setLoaded(true);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load record');
    }
  }

  function set<K extends keyof MedicalRecord>(key: K, value: string) {
    setRecord((r) => ({ ...r, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId) {
      onError('Select a student first');
      return;
    }
    setBusy(true);
    try {
      await clinicApi.upsertRecord(studentId, record);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void save(e)} className="grid gap-2">
      <Field label={t('clinic.student')}>
        <EntityPicker
          value={studentId}
          onChange={(id) => void loadRecord(id)}
          load={loadStudentOptions}
        />
      </Field>
      {loaded ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('clinic.bloodType')} htmlFor="rec-bloodType">
              <Input
                id="rec-bloodType"
                placeholder={t('clinic.bloodType')}
                value={record.bloodType ?? ''}
                onChange={(e) => set('bloodType', e.target.value)}
              />
            </Field>
            <Field label={t('clinic.emergencyContact')} htmlFor="rec-emergencyContact">
              <Input
                id="rec-emergencyContact"
                placeholder={t('clinic.emergencyContact')}
                value={record.emergencyContact ?? ''}
                onChange={(e) => set('emergencyContact', e.target.value)}
              />
            </Field>
          </div>
          <Field label={t('clinic.allergies')} htmlFor="rec-allergies">
            <Input
              id="rec-allergies"
              placeholder={t('clinic.allergies')}
              value={record.allergies ?? ''}
              onChange={(e) => set('allergies', e.target.value)}
            />
          </Field>
          <Field label={t('clinic.chronicConditions')} htmlFor="rec-chronicConditions">
            <Input
              id="rec-chronicConditions"
              placeholder={t('clinic.chronicConditions')}
              value={record.chronicConditions ?? ''}
              onChange={(e) => set('chronicConditions', e.target.value)}
            />
          </Field>
          <Field label={t('clinic.medications')} htmlFor="rec-medications">
            <Input
              id="rec-medications"
              placeholder={t('clinic.medications')}
              value={record.medications ?? ''}
              onChange={(e) => set('medications', e.target.value)}
            />
          </Field>
          <Field label={t('clinic.notes')} htmlFor="rec-notes">
            <Input
              id="rec-notes"
              placeholder={t('clinic.notes')}
              value={record.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? t('common.saving') : t('clinic.saveRecord')}
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t('clinic.selectStudentRecord')}</p>
      )}
    </form>
  );
}
