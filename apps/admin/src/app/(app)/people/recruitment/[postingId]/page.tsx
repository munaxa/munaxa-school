'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Shell } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import { usePrincipal } from '@/components/shell';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DateTimePicker,
  Field,
  Input,
  PageHeader,
  Select,
  useToast,
} from '@axa/platform';
import {
  APPLICANT_STATUSES,
  recruitmentApi,
  type ApplicantStatus,
  type JobApplicant,
} from '@/lib/people';

const STATUS_TONE: Record<ApplicantStatus, 'default' | 'success' | 'warning' | 'danger' | 'muted'> =
  {
    APPLIED: 'default',
    SCREENING: 'default',
    INTERVIEW: 'warning',
    OFFER: 'warning',
    HIRED: 'success',
    REJECTED: 'danger',
    WITHDRAWN: 'muted',
  };

export default function PostingDetailPage() {
  const params = useParams<{ postingId: string }>();
  const postingId = params.postingId;
  const { t } = useI18n();
  const principal = usePrincipal();
  const canManage = principal.permissions.includes('recruitment:manage') || principal.isPlatform;
  const toast = useToast();
  const [applicants, setApplicants] = useState<JobApplicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '' });

  const load = useCallback(async () => {
    try {
      setApplicants(await recruitmentApi.listApplicants(postingId));
    } finally {
      setLoading(false);
    }
  }, [postingId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addApplicant() {
    if (!form.firstName.trim() || !form.lastName.trim()) return;
    try {
      await recruitmentApi.createApplicant(postingId, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        ...(form.email ? { email: form.email } : {}),
      });
      setForm({ firstName: '', lastName: '', email: '' });
      toast.success(t('common.saved'));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
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
        <PageHeader
          title={t('hr.applicants')}
          align="center"
          actions={
            <Link
              href="/people/recruitment"
              className="text-sm text-muted-foreground hover:text-primary-strong"
            >
              ← {t('hr.recruitment')}
            </Link>
          }
        />

        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('hr.addApplicant')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-2">
                <Field label={t('hr.firstName')}>
                  <Input
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  />
                </Field>
                <Field label={t('hr.lastName')}>
                  <Input
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  />
                </Field>
                <Field label={t('hr.personalEmail')} className="flex-1 min-w-40">
                  <Input
                    type="email"
                    dir="ltr"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </Field>
                <Button
                  size="sm"
                  onClick={() => void addApplicant()}
                  disabled={!form.firstName.trim() || !form.lastName.trim()}
                >
                  {t('common.add')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {applicants.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('hr.noApplicants')}</p>
        ) : (
          applicants.map((a) => (
            <ApplicantCard key={a.id} applicant={a} canManage={canManage} onChanged={load} />
          ))
        )}
      </div>
    </Shell>
  );
}

function ApplicantCard({
  applicant,
  canManage,
  onChanged,
}: {
  applicant: JobApplicant;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const hired = applicant.status === 'HIRED';
  const [interview, setInterview] = useState({ scheduledAt: '', mode: 'ONSITE' });
  const [hireForm, setHireForm] = useState({ firstNameAr: '', lastNameAr: '' });
  const [showHire, setShowHire] = useState(false);

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function scheduleInterview() {
    if (!interview.scheduledAt) return;
    await act(() =>
      recruitmentApi.createInterview(applicant.id, {
        scheduledAt: new Date(interview.scheduledAt).toISOString(),
        mode: interview.mode as 'ONSITE' | 'PHONE' | 'VIDEO',
      }),
    );
    setInterview({ scheduledAt: '', mode: 'ONSITE' });
  }

  async function hire() {
    if (!hireForm.firstNameAr.trim() || !hireForm.lastNameAr.trim()) return;
    await act(() =>
      recruitmentApi.hire(applicant.id, {
        firstNameAr: hireForm.firstNameAr.trim(),
        lastNameAr: hireForm.lastNameAr.trim(),
      }),
    );
    setShowHire(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {applicant.firstName} {applicant.lastName}
          <Badge tone={STATUS_TONE[applicant.status]}>
            {t(`hr.applicantStatus.${applicant.status}`)}
          </Badge>
          {applicant.email ? (
            <span className="text-xs font-normal text-muted-foreground">{applicant.email}</span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {canManage && !hired ? (
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t('common.status')}>
              <Select
                value={applicant.status}
                onChange={(e) =>
                  void act(() =>
                    recruitmentApi.updateApplicant(applicant.id, {
                      status: e.target.value as ApplicantStatus,
                    }),
                  )
                }
              >
                {APPLICANT_STATUSES.filter((s) => s !== 'HIRED').map((s) => (
                  <option key={s} value={s}>
                    {t(`hr.applicantStatus.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Button size="sm" variant="outline" onClick={() => setShowHire((v) => !v)}>
              {t('hr.hire')}
            </Button>
          </div>
        ) : null}

        {showHire && !hired ? (
          <div className="flex flex-wrap items-end gap-2 rounded-md border border-border p-2">
            <Field label={`${t('hr.firstName')} (${t('common.arabic')})`}>
              <Input
                value={hireForm.firstNameAr}
                onChange={(e) => setHireForm({ ...hireForm, firstNameAr: e.target.value })}
              />
            </Field>
            <Field label={`${t('hr.lastName')} (${t('common.arabic')})`}>
              <Input
                value={hireForm.lastNameAr}
                onChange={(e) => setHireForm({ ...hireForm, lastNameAr: e.target.value })}
              />
            </Field>
            <Button
              size="sm"
              onClick={() => void hire()}
              disabled={!hireForm.firstNameAr.trim() || !hireForm.lastNameAr.trim()}
            >
              {t('hr.confirmHire')}
            </Button>
          </div>
        ) : null}

        <div className="border-t border-border pt-2">
          <p className="mb-1 text-sm font-medium">{t('hr.interviews')}</p>
          {applicant.interviews.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('hr.noInterviews')}</p>
          ) : (
            <ul className="space-y-1">
              {applicant.interviews.map((iv) => (
                <li key={iv.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {iv.scheduledAt.slice(0, 16).replace('T', ' ')}
                    <span className="ms-2 text-xs text-muted-foreground">
                      {t(`hr.interviewMode.${iv.mode}`)}
                    </span>
                  </span>
                  {canManage && iv.outcome === 'PENDING' ? (
                    <span className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void act(() =>
                            recruitmentApi.updateInterview(iv.id, { outcome: 'PASSED' }),
                          )
                        }
                      >
                        {t('hr.pass')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() =>
                          void act(() =>
                            recruitmentApi.updateInterview(iv.id, { outcome: 'FAILED' }),
                          )
                        }
                      >
                        {t('hr.fail')}
                      </Button>
                    </span>
                  ) : (
                    <Badge tone={iv.outcome === 'PASSED' ? 'success' : 'danger'}>
                      {t(`hr.interviewOutcome.${iv.outcome}`)}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canManage && !hired ? (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <Field label={t('hr.interviewTime')}>
                <DateTimePicker
                  value={interview.scheduledAt}
                  onChange={(value) => setInterview({ ...interview, scheduledAt: value })}
                />
              </Field>
              <Field label={t('hr.mode')}>
                <Select
                  value={interview.mode}
                  onChange={(e) => setInterview({ ...interview, mode: e.target.value })}
                >
                  <option value="ONSITE">{t('hr.interviewMode.ONSITE')}</option>
                  <option value="PHONE">{t('hr.interviewMode.PHONE')}</option>
                  <option value="VIDEO">{t('hr.interviewMode.VIDEO')}</option>
                </Select>
              </Field>
              <Button
                size="sm"
                onClick={() => void scheduleInterview()}
                disabled={!interview.scheduledAt}
              >
                {t('hr.schedule')}
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
