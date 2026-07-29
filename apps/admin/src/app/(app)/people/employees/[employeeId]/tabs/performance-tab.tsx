'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
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
  performanceApi,
  type PerformanceCycle,
  type PerformanceReview,
  type PerformanceReviewStatus,
} from '@/lib/people';

const REVIEW_TONE: Record<PerformanceReviewStatus, 'default' | 'success' | 'warning' | 'muted'> = {
  DRAFT: 'muted',
  SUBMITTED: 'warning',
  ACKNOWLEDGED: 'success',
};

export function PerformanceTab({
  employeeId,
  canManage,
}: {
  employeeId: string;
  canManage: boolean;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [cycles, setCycles] = useState<PerformanceCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycleId, setCycleId] = useState('');

  const load = useCallback(async () => {
    try {
      const [revs, cyc] = await Promise.all([
        performanceApi.listReviews(employeeId),
        performanceApi.listCycles().catch(() => [] as PerformanceCycle[]),
      ]);
      setReviews(revs);
      setCycles(cyc);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createReview() {
    if (!cycleId) return;
    try {
      await performanceApi.createReview(employeeId, cycleId);
      setCycleId('');
      toast.success(t('common.saved'));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;

  const usedCycleIds = new Set(reviews.map((r) => r.cycleId));
  const availableCycles = cycles.filter((c) => !usedCycleIds.has(c.id));

  return (
    <div className="space-y-4">
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('hr.newReview')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-2">
              <Field label={t('hr.cycle')} className="min-w-52">
                <Select value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
                  <option value="">—</option>
                  {availableCycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button size="sm" onClick={() => void createReview()} disabled={!cycleId}>
                {t('common.add')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('hr.noReviews')}</p>
      ) : (
        reviews.map((r) => (
          <ReviewCard
            key={r.id}
            review={r}
            canManage={canManage}
            onChanged={load}
            tone={REVIEW_TONE}
          />
        ))
      )}
    </div>
  );
}

function ReviewCard({
  review,
  canManage,
  onChanged,
  tone,
}: {
  review: PerformanceReview;
  canManage: boolean;
  onChanged: () => Promise<void>;
  tone: Record<PerformanceReviewStatus, 'default' | 'success' | 'warning' | 'muted'>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const editable = canManage && review.status !== 'ACKNOWLEDGED';
  const [form, setForm] = useState({
    overallRating: review.overallRating != null ? String(review.overallRating) : '',
    summary: review.summary ?? '',
    strengths: review.strengths ?? '',
    improvements: review.improvements ?? '',
  });
  const [goal, setGoal] = useState({ title: '', weight: '' });

  async function save() {
    try {
      await performanceApi.updateReview(review.id, {
        ...(form.overallRating ? { overallRating: Number(form.overallRating) } : {}),
        summary: form.summary,
        strengths: form.strengths,
        improvements: form.improvements,
      });
      toast.success(t('common.saved'));
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function addGoal() {
    if (!goal.title.trim()) return;
    await act(() =>
      performanceApi.addGoal(review.id, {
        title: goal.title.trim(),
        ...(goal.weight ? { weight: Number(goal.weight) } : {}),
      }),
    );
    setGoal({ title: '', weight: '' });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {review.cycle.name}
          <Badge tone={tone[review.status]}>{t(`hr.reviewStatus.${review.status}`)}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label={t('hr.overallRating')}>
            <Input
              type="number"
              dir="ltr"
              min={1}
              max={5}
              disabled={!editable}
              value={form.overallRating}
              onChange={(e) => setForm({ ...form, overallRating: e.target.value })}
            />
          </Field>
          <Field label={t('hr.reviewSummary')}>
            <Input
              disabled={!editable}
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
          </Field>
          <Field label={t('hr.strengths')}>
            <Input
              disabled={!editable}
              value={form.strengths}
              onChange={(e) => setForm({ ...form, strengths: e.target.value })}
            />
          </Field>
          <Field label={t('hr.improvements')}>
            <Input
              disabled={!editable}
              value={form.improvements}
              onChange={(e) => setForm({ ...form, improvements: e.target.value })}
            />
          </Field>
        </div>

        {editable ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void save()}>
              {t('common.save')}
            </Button>
            {review.status === 'DRAFT' ? (
              <Button
                size="sm"
                onClick={() => void act(() => performanceApi.submitReview(review.id))}
              >
                {t('hr.submitReview')}
              </Button>
            ) : null}
            {review.status === 'SUBMITTED' ? (
              <Button
                size="sm"
                onClick={() => void act(() => performanceApi.acknowledgeReview(review.id))}
              >
                {t('hr.acknowledge')}
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="border-t border-border pt-3">
          <p className="mb-2 text-sm font-medium">{t('hr.goals')}</p>
          {review.goals.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('hr.noGoals')}</p>
          ) : (
            <ul className="space-y-1">
              {review.goals.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    <span className="font-medium">{g.title}</span>
                    <span className="ms-2 text-xs text-muted-foreground">
                      {t('hr.weight')} {g.weight} · {g.progress}% · {t(`hr.goalStatus.${g.status}`)}
                    </span>
                  </span>
                  {editable ? (
                    <span className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void act(() =>
                            performanceApi.updateGoal(g.id, {
                              progress: Math.min(100, g.progress + 25),
                              status: g.progress + 25 >= 100 ? 'COMPLETED' : 'IN_PROGRESS',
                            }),
                          )
                        }
                      >
                        +25%
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() =>
                          void (async () => {
                            if (!(await confirm())) return;
                            await act(() => performanceApi.removeGoal(g.id));
                          })()
                        }
                      >
                        {t('common.delete')}
                      </Button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {editable ? (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <Field label={t('hr.goalTitle')} className="flex-1 min-w-40">
                <Input
                  value={goal.title}
                  onChange={(e) => setGoal({ ...goal, title: e.target.value })}
                />
              </Field>
              <Field label={t('hr.weight')}>
                <Input
                  type="number"
                  dir="ltr"
                  min={1}
                  max={100}
                  className="w-20"
                  value={goal.weight}
                  onChange={(e) => setGoal({ ...goal, weight: e.target.value })}
                />
              </Field>
              <Button size="sm" onClick={() => void addGoal()} disabled={!goal.title.trim()}>
                {t('common.add')}
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
