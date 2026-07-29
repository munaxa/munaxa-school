'use client';

import { useCallback, useMemo, useState } from 'react';
import { Shell } from '@/components/shell';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EntityPicker,
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
import { useI18n } from '@/components/i18n-provider';
import { loadSectionOptions } from '@/lib/pickers';
import { attendanceApi } from '@/lib/attendance';
import { studentsApi, fullNameEn, fullNameAr, type Student } from '@/lib/people';

type Status = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
const STATUSES: Status[] = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];
const TONE: Record<Status, string> = {
  PRESENT: 'bg-accent-cool text-ink-900',
  LATE: 'bg-accent-warm text-ink-900',
  ABSENT: 'bg-destructive text-destructive-foreground',
  EXCUSED: 'bg-primary text-primary-foreground',
};
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function AttendancePage() {
  const toast = useToast();
  const { t } = useI18n();
  const [sectionId, setSectionId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [classNumber, setPeriodIndex] = useState(1);
  const [roster, setRoster] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!sectionId) return;
    setLoading(true);
    try {
      const [students, existing] = await Promise.all([
        studentsApi.bySection(sectionId),
        attendanceApi.list(sectionId, date, classNumber),
      ]);
      setRoster(students);
      const m: Record<string, Status> = {};
      for (const r of existing) m[r.studentId] = r.status;
      setMarks(m);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load roster');
    } finally {
      setLoading(false);
    }
  }, [sectionId, date, classNumber, toast]);

  const counts = useMemo(() => {
    const c: Record<Status, number> = { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 };
    for (const s of roster) {
      const st = marks[s.id];
      if (st) c[st] += 1;
    }
    return c;
  }, [roster, marks]);
  const marked = counts.PRESENT + counts.LATE + counts.ABSENT + counts.EXCUSED;

  function setAll(status: Status) {
    setMarks(Object.fromEntries(roster.map((s) => [s.id, status])));
  }

  async function save() {
    const records = roster
      .filter((s) => marks[s.id])
      .map((s) => ({ studentId: s.id, status: marks[s.id]! }));
    if (records.length === 0) {
      toast.error('Nothing to save');
      return;
    }
    setSaving(true);
    try {
      const res = await attendanceApi.mark(sectionId, date, classNumber, records);
      toast.success(`Saved ${res.marked} mark(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="font-display text-2xl font-semibold">{t('nav.attendance')}</h1>

        <div className="flex flex-wrap items-end gap-2">
          <Field label={t('attendance.section')} className="flex-1">
            <EntityPicker
              value={sectionId}
              onChange={setSectionId}
              load={loadSectionOptions}
              placeholder={t('attendance.searchSections')}
            />
          </Field>
          <Field label={t('attendance.date')}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t('attendance.period')}>
            <Select
              value={String(classNumber)}
              onChange={(e) => setPeriodIndex(Number(e.target.value))}
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <Button onClick={() => void load()} disabled={!sectionId || loading}>
            {loading ? t('common.loading') : t('attendance.loadRoster')}
          </Button>
        </div>

        {roster.length > 0 ? (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge tone="success">
                    {t('attendance.present')} {counts.PRESENT}
                  </Badge>
                  <Badge tone="warning">
                    {t('attendance.late')} {counts.LATE}
                  </Badge>
                  <Badge tone="danger">
                    {t('attendance.absent')} {counts.ABSENT}
                  </Badge>
                  <Badge tone="default">
                    {t('attendance.excused')} {counts.EXCUSED}
                  </Badge>
                  <span className="text-muted-foreground">
                    {marked}/{roster.length} {t('attendance.markedSuffix')}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setAll('PRESENT')}>
                    {t('attendance.markAllPresent')}
                  </Button>
                  <Button size="sm" onClick={() => void save()} disabled={saving}>
                    {saving ? t('common.saving') : t('attendance.saveAttendance')}
                  </Button>
                </div>
              </div>

              <Table>
                <THead>
                  <TR>
                    <TH>{t('attendance.student')}</TH>
                    <TH className="text-end">{t('common.status')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {roster.map((s) => (
                    <TR key={s.id}>
                      <TD>
                        {fullNameEn(s)}
                        <span className="block text-xs text-muted-foreground" dir="rtl">
                          {fullNameAr(s)}
                        </span>
                      </TD>
                      <TD className="text-end">
                        <span className="inline-flex overflow-hidden rounded-md border border-border">
                          {STATUSES.map((st) => {
                            const active = marks[s.id] === st;
                            return (
                              <button
                                key={st}
                                type="button"
                                aria-label={`${fullNameEn(s)} ${st}`}
                                onClick={() => setMarks((m) => ({ ...m, [s.id]: st }))}
                                className={`px-2.5 py-1 text-xs transition-colors ${
                                  active ? TONE[st] : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                {st[0]}
                              </button>
                            );
                          })}
                        </span>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">{t('attendance.emptyHint')}</p>
        )}
      </div>
    </Shell>
  );
}
