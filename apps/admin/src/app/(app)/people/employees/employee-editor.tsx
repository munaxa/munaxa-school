'use client';

import { useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import { Button, Field, Input, Select, useToast } from '@axa/platform';
import {
  employeesApi,
  EMPLOYEE_ENTRY_STATUSES,
  EMPLOYMENT_TYPES,
  MARITAL_STATUSES,
  type CreateEmployeeInput,
  type Department,
  type Employee,
  type Position,
} from '@/lib/people';

type FormState = {
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string;
  lastNameAr: string;
  jobTitle: string;
  employeeNumber: string;
  nationalId: string;
  passportNumber: string;
  nationality: string;
  gender: string;
  dateOfBirth: string;
  maritalStatus: string;
  religion: string;
  personalEmail: string;
  personalPhone: string;
  employmentType: string;
  status: string;
  hireDate: string;
  probationEndDate: string;
  workingHoursPerWeek: string;
  departmentId: string;
  positionId: string;
  managerId: string;
};

function initialForm(e?: Employee): FormState {
  return {
    firstNameEn: e?.firstNameEn ?? '',
    lastNameEn: e?.lastNameEn ?? '',
    firstNameAr: e?.firstNameAr ?? '',
    lastNameAr: e?.lastNameAr ?? '',
    jobTitle: e?.jobTitle ?? '',
    employeeNumber: e?.employeeNumber ?? '',
    nationalId: e?.nationalId ?? '',
    passportNumber: e?.passportNumber ?? '',
    nationality: e?.nationality ?? '',
    gender: e?.gender ?? '',
    dateOfBirth: (e?.dateOfBirth ?? '').slice(0, 10),
    maritalStatus: e?.maritalStatus ?? '',
    religion: e?.religion ?? '',
    personalEmail: e?.personalEmail ?? '',
    personalPhone: e?.personalPhone ?? '',
    employmentType: e?.employmentType ?? '',
    status: 'ACTIVE',
    hireDate: (e?.hireDate ?? '').slice(0, 10),
    probationEndDate: (e?.probationEndDate ?? '').slice(0, 10),
    workingHoursPerWeek: e?.workingHoursPerWeek != null ? String(e.workingHoursPerWeek) : '',
    departmentId: e?.departmentId ?? '',
    positionId: e?.positionId ?? '',
    managerId: e?.managerId ?? '',
  };
}

/** Shared create/edit form for an employee. `employee` undefined ⇒ create. */
export function EmployeeEditor({
  employee,
  departments,
  positions,
  managers,
  onClose,
  onSaved,
}: {
  employee?: Employee;
  departments: Department[];
  positions: Position[];
  managers: Employee[];
  onClose: () => void;
  onSaved: (saved: Employee) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const isEdit = Boolean(employee);
  const [form, setForm] = useState<FormState>(() => initialForm(employee));
  const [busy, setBusy] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** Only send non-empty values; empty strings for optional fields are omitted. */
  function payload(): CreateEmployeeInput {
    const base: CreateEmployeeInput = {
      firstNameEn: form.firstNameEn.trim(),
      lastNameEn: form.lastNameEn.trim(),
      firstNameAr: form.firstNameAr.trim(),
      lastNameAr: form.lastNameAr.trim(),
      jobTitle: form.jobTitle.trim(),
    };
    const str = (value: string, apply: (v: string) => void) => {
      const v = value.trim();
      if (v) apply(v);
    };
    str(form.employeeNumber, (v) => (base.employeeNumber = v));
    str(form.nationalId, (v) => (base.nationalId = v));
    str(form.passportNumber, (v) => (base.passportNumber = v));
    str(form.nationality, (v) => (base.nationality = v));
    if (form.gender) base.gender = form.gender as NonNullable<CreateEmployeeInput['gender']>;
    str(form.dateOfBirth, (v) => (base.dateOfBirth = v));
    if (form.maritalStatus)
      base.maritalStatus = form.maritalStatus as NonNullable<CreateEmployeeInput['maritalStatus']>;
    str(form.religion, (v) => (base.religion = v));
    str(form.personalEmail, (v) => (base.personalEmail = v));
    str(form.personalPhone, (v) => (base.personalPhone = v));
    if (form.employmentType)
      base.employmentType = form.employmentType as NonNullable<
        CreateEmployeeInput['employmentType']
      >;
    str(form.hireDate, (v) => (base.hireDate = v));
    str(form.probationEndDate, (v) => (base.probationEndDate = v));
    str(form.workingHoursPerWeek, (v) => (base.workingHoursPerWeek = Number(v)));
    if (form.departmentId) base.departmentId = form.departmentId;
    if (form.positionId) base.positionId = form.positionId;
    if (form.managerId) base.managerId = form.managerId;
    if (!isEdit && form.status)
      base.status = form.status as NonNullable<CreateEmployeeInput['status']>;
    return base;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const data = payload();
      const saved = employee
        ? await employeesApi.update(employee.id, data)
        : await employeesApi.create(data);
      toast.success(isEdit ? t('hr.employeeSaved') : t('people.addEmployee'));
      onSaved(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  const managerOptions = managers.filter((m) => m.id !== employee?.id);

  return (
    <div className="fixed inset-0 z-modal flex items-start justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-foreground/40" onClick={onClose} aria-hidden="true" />
      <div
        className="relative my-8 w-full max-w-3xl rounded-xl border border-border bg-card p-5 shadow-card"
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">
            {isEdit ? t('hr.editEmployee') : t('people.addEmployee')}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label={t('common.cancel')}>
            ✕
          </Button>
        </div>

        <form onSubmit={(e) => void submit(e)} className="space-y-5">
          <Section title={t('hr.personalInfo')}>
            <Field label={t('common.firstNameEn')}>
              <Input
                value={form.firstNameEn}
                onChange={(e) => set('firstNameEn', e.target.value)}
                required
              />
            </Field>
            <Field label={t('common.lastNameEn')}>
              <Input
                value={form.lastNameEn}
                onChange={(e) => set('lastNameEn', e.target.value)}
                required
              />
            </Field>
            <Field label="الاسم (AR)">
              <Input
                dir="rtl"
                value={form.firstNameAr}
                onChange={(e) => set('firstNameAr', e.target.value)}
                required
              />
            </Field>
            <Field label="العائلة (AR)">
              <Input
                dir="rtl"
                value={form.lastNameAr}
                onChange={(e) => set('lastNameAr', e.target.value)}
                required
              />
            </Field>
            <Field label={t('people.gender')}>
              <Select value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                <option value="">—</option>
                <option value="MALE">{t('people.male')}</option>
                <option value="FEMALE">{t('people.female')}</option>
              </Select>
            </Field>
            <Field label={t('hr.dob')}>
              <Input
                type="date"
                dir="ltr"
                value={form.dateOfBirth}
                onChange={(e) => set('dateOfBirth', e.target.value)}
              />
            </Field>
            <Field label={t('people.nationalId')}>
              <Input value={form.nationalId} onChange={(e) => set('nationalId', e.target.value)} />
            </Field>
            <Field label={t('hr.passport')}>
              <Input
                value={form.passportNumber}
                onChange={(e) => set('passportNumber', e.target.value)}
              />
            </Field>
            <Field label={t('hr.nationality')}>
              <Input
                value={form.nationality}
                onChange={(e) => set('nationality', e.target.value)}
              />
            </Field>
            <Field label={t('hr.maritalStatus')}>
              <Select
                value={form.maritalStatus}
                onChange={(e) => set('maritalStatus', e.target.value)}
              >
                <option value="">—</option>
                {MARITAL_STATUSES.map((m) => (
                  <option key={m} value={m}>
                    {t(`hr.marital.${m}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('hr.religion')}>
              <Input value={form.religion} onChange={(e) => set('religion', e.target.value)} />
            </Field>
            <Field label={t('hr.personalEmail')}>
              <Input
                type="email"
                dir="ltr"
                value={form.personalEmail}
                onChange={(e) => set('personalEmail', e.target.value)}
              />
            </Field>
            <Field label={t('hr.personalPhone')}>
              <Input
                dir="ltr"
                value={form.personalPhone}
                onChange={(e) => set('personalPhone', e.target.value)}
              />
            </Field>
          </Section>

          <Section title={t('hr.employmentDetails')}>
            <Field label={t('people.jobTitle')}>
              <Input
                value={form.jobTitle}
                onChange={(e) => set('jobTitle', e.target.value)}
                required
              />
            </Field>
            <Field label={t('people.employeeNumber')}>
              <Input
                value={form.employeeNumber}
                onChange={(e) => set('employeeNumber', e.target.value)}
              />
            </Field>
            <Field label={t('hr.employmentType')}>
              <Select
                value={form.employmentType}
                onChange={(e) => set('employmentType', e.target.value)}
              >
                <option value="">—</option>
                {EMPLOYMENT_TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {t(`hr.type.${ty}`)}
                  </option>
                ))}
              </Select>
            </Field>
            {!isEdit ? (
              <Field label={t('common.status')}>
                <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {EMPLOYEE_ENTRY_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`hr.status.${s}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label={t('hr.hireDate')}>
              <Input
                type="date"
                dir="ltr"
                value={form.hireDate}
                onChange={(e) => set('hireDate', e.target.value)}
              />
            </Field>
            <Field label={t('hr.probationEnd')}>
              <Input
                type="date"
                dir="ltr"
                value={form.probationEndDate}
                onChange={(e) => set('probationEndDate', e.target.value)}
              />
            </Field>
            <Field label={t('hr.workingHours')}>
              <Input
                type="number"
                dir="ltr"
                min={0}
                max={168}
                step={0.5}
                value={form.workingHoursPerWeek}
                onChange={(e) => set('workingHoursPerWeek', e.target.value)}
              />
            </Field>
          </Section>

          <Section title={t('hr.orgPlacement')}>
            <Field label={t('people.department')}>
              <Select
                value={form.departmentId}
                onChange={(e) => set('departmentId', e.target.value)}
              >
                <option value="">{t('hr.unassigned')}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('hr.position')}>
              <Select value={form.positionId} onChange={(e) => set('positionId', e.target.value)}>
                <option value="">{t('hr.unassigned')}</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('hr.manager')}>
              <Select value={form.managerId} onChange={(e) => set('managerId', e.target.value)}>
                <option value="">{t('hr.unassigned')}</option>
                {managerOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.firstNameEn} {m.lastNameEn}
                  </option>
                ))}
              </Select>
            </Field>
          </Section>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t('common.saving') : t('common.saveChanges')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
