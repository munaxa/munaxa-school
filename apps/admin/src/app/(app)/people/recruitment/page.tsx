'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
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
  Field,
  Input,
  Select,
  useToast,
} from '@axa/platform';
import { useConfirm } from '@/components/confirm';
import {
  JOB_POSTING_STATUSES,
  recruitmentApi,
  type JobPosting,
  type JobPostingStatus,
} from '@/lib/people';

const TONE: Record<JobPostingStatus, 'default' | 'success' | 'warning' | 'muted'> = {
  DRAFT: 'muted',
  OPEN: 'success',
  CLOSED: 'warning',
  FILLED: 'default',
};

export default function RecruitmentPage() {
  const { t } = useI18n();
  const principal = usePrincipal();
  const canManage = principal.permissions.includes('recruitment:manage') || principal.isPlatform;
  const toast = useToast();
  const confirm = useConfirm();
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setPostings(await recruitmentApi.listPostings());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await recruitmentApi.createPosting({ title: title.trim(), status: 'OPEN' });
      setTitle('');
      toast.success(t('common.saved'));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(p: JobPosting, status: JobPostingStatus) {
    try {
      await recruitmentApi.updatePosting(p.id, { status });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function remove(p: JobPosting) {
    if (!(await confirm())) return;
    try {
      await recruitmentApi.removePosting(p.id);
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
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold">{t('hr.recruitment')}</h1>
          <Link
            href="/people/employees"
            className="text-sm text-muted-foreground hover:text-primary-strong"
          >
            ← {t('nav.hr')}
          </Link>
        </div>

        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('hr.newPosting')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-2">
                <Field label={t('hr.jobTitle')} className="flex-1 min-w-52">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Math Teacher"
                  />
                </Field>
                <Button size="sm" onClick={() => void create()} disabled={busy || !title.trim()}>
                  {t('common.add')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t('hr.jobPostings')}</CardTitle>
          </CardHeader>
          <CardContent>
            {postings.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('hr.noPostings')}</p>
            ) : (
              <ul className="divide-y divide-border">
                {postings.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div>
                      <Link
                        href={`/people/recruitment/${p.id}`}
                        className="font-medium hover:text-primary-strong"
                      >
                        {p.title}
                      </Link>
                      <Badge tone={TONE[p.status]} className="ms-2">
                        {t(`hr.postingStatus.${p.status}`)}
                      </Badge>
                      <span className="ms-2 text-xs text-muted-foreground">
                        {p._count.applicants} {t('hr.applicants')}
                      </span>
                    </div>
                    {canManage ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <Select
                          className="w-32"
                          value={p.status}
                          onChange={(e) => void setStatus(p, e.target.value as JobPostingStatus)}
                        >
                          {JOB_POSTING_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {t(`hr.postingStatus.${s}`)}
                            </option>
                          ))}
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => void remove(p)}
                        >
                          {t('common.delete')}
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}
