'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Shell, usePrincipal } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import { useConfirm } from '@/components/confirm';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Spinner,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  useToast,
} from '@munaxa/ui';
import { subjectsApi, type Subject } from '@/lib/scheduling';

/**
 * Subject catalogue for the timetable. Subjects are tenant-wide (not per campus or per year), so
 * this screen is the single place they are created — every schedule plan then picks from this list
 * when a class is added.
 */

/*
 * Suggested subject palette — distinguishable hues so a week of lessons stays readable at a glance.
 *
 * These hex values are *data*, not styling: each one is persisted on the Subject row (`colorHex`,
 * validated as a hex by the API) and painted per subject wherever the timetable renders. Design
 * tokens cannot express them — a token names one fixed role, while this list is a set of choices
 * the school picks from and can override with any colour via the custom picker below. Hence the
 * one-off exemption from the no-hardcoded-hex guardrail, which stands for the rest of this screen.
 */
/* eslint-disable no-restricted-syntax */
const PALETTE = [
  '#2563eb',
  '#0ea5e9',
  '#14b8a6',
  '#22c55e',
  '#eab308',
  '#f97316',
  '#ef4444',
  '#ec4899',
  '#8b5cf6',
  '#64748b',
];

/** Matches the Subject model's own default, so the picker and the database agree. */
const DEFAULT_COLOR = '#64748b';
/* eslint-enable no-restricted-syntax */

interface SubjectForm {
  nameEn: string;
  nameAr: string;
  code: string;
  colorHex: string;
}

const emptyForm = (): SubjectForm => ({
  nameEn: '',
  nameAr: '',
  code: '',
  colorHex: PALETTE[0]!,
});

export default function SubjectsPage() {
  return (
    <Suspense fallback={null}>
      <SubjectsCatalogue />
    </Suspense>
  );
}

/** The selection the timetable workspace holds in its own URL. */
const TIMETABLE_PARAMS = [
  'school',
  'campus',
  'year',
  'semester',
  'plan',
  'classroom',
  'schedule',
] as const;

/**
 * Rebuild the timetable the user came from. The workspace passes its own selection as `back`, so
 * the link returns to that grid rather than an empty workspace. Only the parameters the workspace
 * itself understands are copied over — the link is always to `/timetable`, never to a destination
 * the query string chose.
 */
function backToTimetable(back: string | null): Record<string, string> {
  const query: Record<string, string> = {};
  if (!back) return query;
  const source = new URLSearchParams(back);
  for (const key of TIMETABLE_PARAMS) {
    const value = source.get(key);
    if (value) query[key] = value;
  }
  return query;
}

function SubjectsCatalogue() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const backQuery = backToTimetable(searchParams.get('back'));
  const toast = useToast();
  const confirm = useConfirm();
  const principal = usePrincipal();
  const canManage = principal.permissions.includes('timetable:manage') || principal.isPlatform;

  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [editing, setEditing] = useState<{ form: SubjectForm; subject: Subject | null } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    // Include the deactivated ones: this screen is where they are reactivated.
    subjectsApi
      .list(true)
      .then(setSubjects)
      .catch((e) => {
        setSubjects([]);
        toast.error(e instanceof Error ? e.message : 'Failed to load subjects');
      });
  }, [toast]);

  useEffect(() => load(), [load]);

  async function save() {
    if (!editing) return;
    const { form, subject } = editing;
    if (!form.nameEn.trim() || !form.nameAr.trim()) {
      toast.error(t('subjects.nameRequired'));
      return;
    }
    setBusy(true);
    try {
      const code = form.code.trim();
      const payload = {
        nameEn: form.nameEn.trim(),
        nameAr: form.nameAr.trim(),
        colorHex: form.colorHex || DEFAULT_COLOR,
      };
      if (subject) {
        // An emptied code is cleared with an explicit null; omitting it would keep the old one.
        await subjectsApi.update(subject.id, { ...payload, code: code || null });
        toast.success(t('subjects.updated'));
      } else {
        await subjectsApi.create(code ? { ...payload, code } : payload);
        toast.success(t('subjects.created'));
      }
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(subject: Subject) {
    try {
      await subjectsApi.update(subject.id, { isActive: !subject.isActive });
      toast.success(subject.isActive ? t('subjects.deactivated') : t('subjects.activated'));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  }

  async function remove(subject: Subject) {
    if (!(await confirm({ description: t('subjects.deleteConfirm') }))) return;
    try {
      await subjectsApi.remove(subject.id);
      toast.success(t('subjects.deleted'));
      load();
    } catch (e) {
      // The API refuses to delete a subject that scheduled classes still reference — surface that
      // reason as-is and point at the alternative (deactivate keeps history intact).
      toast.error(e instanceof Error ? e.message : t('subjects.deleteBlocked'));
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader title={t('subjects.title')} description={t('subjects.subtitle')} />

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>{t('subjects.catalogue')}</CardTitle>
              <div className="flex items-center gap-2">
                <Link
                  href={{ pathname: '/timetable', query: backQuery }}
                  className="text-sm font-medium text-primary-strong hover:underline"
                >
                  {t('subjects.backToTimetable')} →
                </Link>
                {canManage ? (
                  <Button onClick={() => setEditing({ form: emptyForm(), subject: null })}>
                    {t('subjects.addSubject')}
                  </Button>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {subjects === null ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : subjects.length === 0 ? (
              <div className="space-y-2">
                <EmptyState title={t('subjects.empty')} />
                <p className="text-center text-sm text-muted-foreground">
                  {t('subjects.emptyHint')}
                </p>
              </div>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>{t('subjects.subject')}</TH>
                    <TH>{t('common.arabicName')}</TH>
                    <TH>{t('subjects.code')}</TH>
                    <TH>{t('common.status')}</TH>
                    {canManage ? <TH>{t('common.actions')}</TH> : null}
                  </TR>
                </THead>
                <TBody>
                  {subjects.map((s) => (
                    <TR key={s.id}>
                      <TD>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ background: s.colorHex }}
                            aria-hidden="true"
                          />
                          {s.nameEn}
                        </span>
                      </TD>
                      <TD>{s.nameAr}</TD>
                      <TD>
                        <span className="font-mono text-xs text-muted-foreground">
                          {s.code || '—'}
                        </span>
                      </TD>
                      <TD>
                        <Badge tone={s.isActive ? 'success' : 'muted'}>
                          {s.isActive ? t('subjects.active') : t('subjects.inactive')}
                        </Badge>
                      </TD>
                      {canManage ? (
                        <TD>
                          <div className="flex flex-wrap gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setEditing({
                                  subject: s,
                                  form: {
                                    nameEn: s.nameEn,
                                    nameAr: s.nameAr,
                                    code: s.code ?? '',
                                    colorHex: s.colorHex || DEFAULT_COLOR,
                                  },
                                })
                              }
                            >
                              {t('common.edit')}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => void toggleActive(s)}>
                              {s.isActive ? t('subjects.deactivate') : t('subjects.activate')}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => void remove(s)}>
                              {t('common.delete')}
                            </Button>
                          </div>
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

      {editing ? (
        <Dialog
          open
          onClose={() => setEditing(null)}
          title={editing.subject ? t('subjects.editTitle') : t('subjects.addSubject')}
          description={t('subjects.dialogHint')}
          footer={
            <>
              <Button variant="outline" onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={() => void save()} disabled={busy}>
                {busy ? t('common.saving') : t('common.save')}
              </Button>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('structure.nameEn')}>
              <Input
                value={editing.form.nameEn}
                placeholder="Mathematics"
                onChange={(e) => setForm({ nameEn: e.target.value })}
              />
            </Field>
            <Field label={t('structure.nameAr')}>
              <Input
                value={editing.form.nameAr}
                placeholder="الرياضيات"
                dir="rtl"
                onChange={(e) => setForm({ nameAr: e.target.value })}
              />
            </Field>
            <Field label={`${t('subjects.code')} (${t('common.optional')})`}>
              <Input
                value={editing.form.code}
                placeholder="MATH"
                onChange={(e) => setForm({ code: e.target.value.toUpperCase() })}
              />
            </Field>
            <Field label={t('subjects.color')}>
              <div className="flex flex-wrap items-center gap-1.5">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    aria-pressed={editing.form.colorHex.toLowerCase() === c}
                    onClick={() => setForm({ colorHex: c })}
                    className={
                      editing.form.colorHex.toLowerCase() === c
                        ? 'h-6 w-6 rounded-full ring-2 ring-foreground ring-offset-2 ring-offset-background'
                        : 'h-6 w-6 rounded-full ring-1 ring-border'
                    }
                    style={{ background: c }}
                  />
                ))}
                <input
                  type="color"
                  aria-label={t('subjects.customColor')}
                  value={editing.form.colorHex}
                  onChange={(e) => setForm({ colorHex: e.target.value })}
                  className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent p-0"
                />
              </div>
            </Field>
          </div>
        </Dialog>
      ) : null}
    </Shell>
  );

  function setForm(patch: Partial<SubjectForm>) {
    setEditing((cur) => (cur ? { ...cur, form: { ...cur.form, ...patch } } : cur));
  }
}
