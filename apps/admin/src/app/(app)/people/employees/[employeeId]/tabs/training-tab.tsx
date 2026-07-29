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
  trainingApi,
  TRAINING_RECORD_STATUSES,
  type TrainingCourse,
  type TrainingRecord,
  type TrainingRecordStatus,
} from '@/lib/people';

const STATUS_TONE: Record<
  TrainingRecordStatus,
  'default' | 'success' | 'warning' | 'danger' | 'muted'
> = {
  ENROLLED: 'default',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  FAILED: 'danger',
  CANCELLED: 'muted',
};

export function TrainingTab({ employeeId, canManage }: { employeeId: string; canManage: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseId, setCourseId] = useState('');

  const load = useCallback(async () => {
    try {
      const [recs, crs] = await Promise.all([
        trainingApi.listForEmployee(employeeId),
        trainingApi.listCourses().catch(() => [] as TrainingCourse[]),
      ]);
      setRecords(recs);
      setCourses(crs.filter((c) => c.isActive));
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function enroll() {
    if (!courseId) return;
    try {
      await trainingApi.enroll(employeeId, courseId);
      setCourseId('');
      toast.success(t('common.saved'));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function setStatus(id: string, status: TrainingRecordStatus) {
    try {
      await trainingApi.updateRecord(id, { status });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;

  const enrolledCourseIds = new Set(records.map((r) => r.courseId));
  const availableCourses = courses.filter((c) => !enrolledCourseIds.has(c.id));

  return (
    <div className="space-y-4">
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('hr.enrollTraining')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-2">
              <Field label={t('hr.course')} className="min-w-52">
                <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                  <option value="">—</option>
                  {availableCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button size="sm" onClick={() => void enroll()} disabled={!courseId}>
                {t('hr.enroll')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('hr.trainingRecords')}</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('hr.noTraining')}</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>{t('hr.course')}</TH>
                  <TH>{t('common.status')}</TH>
                  <TH className="text-end">{t('hr.score')}</TH>
                  <TH>{t('hr.expires')}</TH>
                  {canManage ? <TH>{t('common.actions')}</TH> : null}
                </TR>
              </THead>
              <TBody>
                {records.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      {r.course.title}
                      {r.course.mandatory ? (
                        <Badge tone="warning" className="ms-2">
                          {t('hr.mandatory')}
                        </Badge>
                      ) : null}
                    </TD>
                    <TD>
                      <Badge tone={STATUS_TONE[r.status]}>
                        {t(`hr.trainingStatus.${r.status}`)}
                      </Badge>
                    </TD>
                    <TD className="text-end font-mono text-xs">
                      {r.score != null ? Number(r.score) : '—'}
                    </TD>
                    <TD className="text-xs text-muted-foreground">
                      {r.expiresAt ? r.expiresAt.slice(0, 10) : '—'}
                    </TD>
                    {canManage ? (
                      <TD>
                        <Select
                          value={r.status}
                          onChange={(e) =>
                            void setStatus(r.id, e.target.value as TrainingRecordStatus)
                          }
                        >
                          {TRAINING_RECORD_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {t(`hr.trainingStatus.${s}`)}
                            </option>
                          ))}
                        </Select>
                      </TD>
                    ) : null}
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
