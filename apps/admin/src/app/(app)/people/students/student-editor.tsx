'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import { Badge, Button, Checkbox, Field, Input, Select, useToast } from '@axa/platform';
import { useConfirm, useAlert } from '@/components/confirm';
import {
  studentsApi,
  type Student,
  type StudentVaccine,
  type UpdateStudentInput,
  type UpsertVaccineInput,
} from '@/lib/people';
import { type Section } from '@/lib/structure';

// Full set — used by the students-list status filter.
export const STUDENT_STATUSES = ['ACTIVE', 'INACTIVE', 'GRADUATED', 'WITHDRAWN'];
// Manually settable states only. Terminal participation states (WITHDRAWN/GRADUATED) are DERIVED
// from the enrollment lifecycle and must be reached via Withdraw / Year-End, never set directly here.
export const EDITABLE_STUDENT_STATUSES = ['ACTIVE', 'INACTIVE'];
export const GENDERS = ['MALE', 'FEMALE'];

/** Grade + section selectors. Grades are derived from the sections list; picking a grade filters
 *  the sections. Emits the chosen section id (the API stores section, not grade). */
export function GradeSectionFields({
  sections,
  sectionId,
  onChange,
}: {
  sections: Section[];
  sectionId: string;
  onChange: (sectionId: string) => void;
}) {
  const { t } = useI18n();
  const grades = [
    ...new Map(
      sections
        .filter((s) => s.grade)
        .map((s) => [
          s.grade!.id,
          { id: s.grade!.id, name: s.grade!.nameEn, level: s.grade!.level },
        ]),
    ).values(),
  ].sort((a, b) => a.level - b.level);
  const [gradeId, setGradeId] = useState(sections.find((s) => s.id === sectionId)?.grade?.id ?? '');
  const sectionsForGrade = sections.filter((s) => s.grade?.id === gradeId);

  return (
    <>
      <Field label={t('structure.grade')}>
        <Select
          value={gradeId}
          onChange={(e) => {
            setGradeId(e.target.value);
            onChange('');
          }}
        >
          <option value="">—</option>
          {grades.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('structure.section')}>
        <Select value={sectionId} onChange={(e) => onChange(e.target.value)} disabled={!gradeId}>
          <option value="">—</option>
          {sectionsForGrade.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}

// --------------------------------------------------------------------------- Student editor (modal)

export function StudentEditor({
  student,
  onClose,
  onSaved,
}: {
  student: Student;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const alert = useAlert();
  // Identity only. Grade, section, classroom, academic year, fee plan and transport are year-scoped
  // placement — they live on the Enrollment and are changed via the Current Enrollment panel, never
  // by editing the Student (Decisions 4 & 13).
  const [form, setForm] = useState<UpdateStudentInput>({
    firstNameEn: student.firstNameEn,
    lastNameEn: student.lastNameEn,
    firstNameAr: student.firstNameAr,
    lastNameAr: student.lastNameAr,
    fatherNameEn: student.fatherNameEn ?? '',
    fatherNameAr: student.fatherNameAr ?? '',
    thirdNameEn: student.thirdNameEn ?? '',
    thirdNameAr: student.thirdNameAr ?? '',
    nationalId: student.nationalId ?? '',
    moeStudentNumber: student.moeStudentNumber ?? '',
    gender: student.gender ?? '',
    status: student.status,
  });
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // Drop empty enum fields — the API rejects "" for gender.
      const payload: UpdateStudentInput = { ...form };
      if (!payload.gender) delete payload.gender;
      await studentsApi.update(student.id, payload);
      toast.success(t('people.studentUpdated'));
      await onSaved();
    } catch (err) {
      await alert({ description: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  const set = (patch: Partial<UpdateStudentInput>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-foreground/40" onClick={onClose} aria-hidden="true" />
      <div
        className="relative my-8 w-full max-w-2xl rounded-xl border border-border bg-card p-5 shadow-card"
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{t('people.editStudent')}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label={t('common.cancel')}>
            ✕
          </Button>
        </div>

        <form onSubmit={(e) => void save(e)} className="grid gap-3 sm:grid-cols-2">
          <Field label={t('common.firstNameEn')}>
            <Input
              value={form.firstNameEn ?? ''}
              onChange={(e) => set({ firstNameEn: e.target.value })}
              required
            />
          </Field>
          <Field label={t('common.lastNameEn')}>
            <Input
              value={form.lastNameEn ?? ''}
              onChange={(e) => set({ lastNameEn: e.target.value })}
              required
            />
          </Field>
          <Field label="الاسم (AR)">
            <Input
              dir="rtl"
              value={form.firstNameAr ?? ''}
              onChange={(e) => set({ firstNameAr: e.target.value })}
              required
            />
          </Field>
          <Field label="العائلة (AR)">
            <Input
              dir="rtl"
              value={form.lastNameAr ?? ''}
              onChange={(e) => set({ lastNameAr: e.target.value })}
              required
            />
          </Field>
          <Field label={`${t('people.nationalId')} *`}>
            <Input
              value={form.nationalId ?? ''}
              onChange={(e) => set({ nationalId: e.target.value })}
              required
            />
          </Field>
          <Field label={t('people.moeNumber')}>
            <Input
              value={form.moeStudentNumber ?? ''}
              onChange={(e) => set({ moeStudentNumber: e.target.value })}
            />
          </Field>
          <Field label={t('people.gender')}>
            <Select value={form.gender ?? ''} onChange={(e) => set({ gender: e.target.value })}>
              <option value="">—</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {t(`people.${g.toLowerCase()}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('common.status')}>
            {EDITABLE_STUDENT_STATUSES.includes(form.status ?? 'ACTIVE') ? (
              <Select
                value={form.status ?? 'ACTIVE'}
                onChange={(e) => set({ status: e.target.value })}
              >
                {EDITABLE_STUDENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            ) : (
              // Terminal (derived) status — shown read-only; changed only via Withdraw / Year-End.
              <>
                <Select value={form.status ?? ''} disabled>
                  <option value={form.status ?? ''}>{form.status}</option>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('studentProfile.statusLifecycleHint')}
                </p>
              </>
            )}
          </Field>

          <div className="col-span-full flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t('common.saving') : t('common.saveChanges')}
            </Button>
          </div>
        </form>

        <div className="mt-6 border-t border-border pt-4">
          <Vaccines studentId={student.id} />
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- Vaccines

const EMPTY_VACCINE: UpsertVaccineInput = { name: '', grade: '', received: true };

export function Vaccines({ studentId }: { studentId: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<StudentVaccine[]>([]);
  const [form, setForm] = useState<UpsertVaccineInput>(EMPTY_VACCINE);

  const load = useCallback(async () => {
    try {
      setRows(await studentsApi.vaccines(studentId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load vaccines');
    }
  }, [studentId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      const payload: UpsertVaccineInput = { name: form.name, received: form.received ?? true };
      if (form.grade) payload.grade = form.grade;
      await studentsApi.addVaccine(studentId, payload);
      setForm(EMPTY_VACCINE);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add vaccine');
    }
  }

  async function toggleReceived(v: StudentVaccine) {
    try {
      await studentsApi.updateVaccine(studentId, v.id, { received: !v.received });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  }

  async function remove(v: StudentVaccine) {
    if (!(await confirm())) return;
    try {
      await studentsApi.removeVaccine(studentId, v.id);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="font-display text-sm font-semibold">{t('people.vaccines')}</h3>

      <ul className="divide-y divide-border text-sm">
        {rows.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-2 py-1.5">
            <div className="min-w-0">
              <span className="font-medium">{v.name}</span>
              {v.grade ? <span className="text-muted-foreground"> · {v.grade}</span> : null}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void toggleReceived(v)}>
                <Badge tone={v.received ? 'success' : 'muted'}>
                  {v.received ? t('people.received') : t('people.notReceived')}
                </Badge>
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => void remove(v)}
                aria-label={`${t('common.delete')} ${v.name}`}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="py-1.5 text-muted-foreground">{t('people.noVaccines')}</li>
        ) : null}
      </ul>

      <form onSubmit={(e) => void add(e)} className="flex flex-wrap items-end gap-2">
        <Input
          className="h-9 flex-1"
          placeholder={t('people.vaccineName')}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <Input
          className="h-9 w-32"
          placeholder={t('people.vaccineGrade')}
          value={form.grade ?? ''}
          onChange={(e) => setForm({ ...form, grade: e.target.value })}
        />
        <label className="flex items-center gap-1.5 pb-2 text-sm text-muted-foreground">
          <Checkbox
            checked={form.received ?? true}
            onChange={(e) => setForm({ ...form, received: e.target.checked })}
          />
          {t('people.received')}
        </label>
        <Button type="submit" size="sm">
          {t('people.addVaccine')}
        </Button>
      </form>
    </div>
  );
}
