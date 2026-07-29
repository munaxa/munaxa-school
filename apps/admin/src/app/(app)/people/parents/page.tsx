'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import { useConfirm } from '@/components/confirm';
import { parentsApi, type CreateParentInput, type Parent } from '@/lib/people';
import { ParentProfileDialog, ParentEditDialog } from '@/components/domain';
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@axa/platform';

const EMPTY: CreateParentInput = {
  firstNameEn: '',
  lastNameEn: '',
  firstNameAr: '',
  lastNameAr: '',
  phone: '',
  phoneAlt: '',
  email: '',
  nationalId: '',
  occupation: '',
};

export default function ParentsPage() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const [parents, setParents] = useState<Parent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Parent | null>(null);
  const [editing, setEditing] = useState<Parent | null>(null);

  const load = useCallback(async () => {
    try {
      setParents(await parentsApi.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load parents');
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
      await parentsApi.remove(id);
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
        <h1 className="font-display text-2xl font-semibold">{t('nav.parents')}</h1>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t('people.addParent')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ParentForm onDone={load} onError={setError} />
          </CardContent>
        </Card>

        <Table>
          <THead>
            <TR>
              <TH>{t('common.name')}</TH>
              <TH>{t('common.arabicName')}</TH>
              <TH>{t('common.phone')}</TH>
              <TH>{t('common.phoneAlt')}</TH>
              <TH>{t('common.email')}</TH>
              <TH>{t('people.nationalId')}</TH>
              <TH>{t('people.occupation')}</TH>
              <TH className="text-end">{t('common.actions')}</TH>
            </TR>
          </THead>
          <TBody>
            {parents.map((p) => (
              <TR key={p.id}>
                <TD>
                  <button
                    type="button"
                    className="text-start font-medium text-foreground hover:text-primary-strong hover:underline"
                    onClick={() => setViewing(p)}
                  >
                    {p.firstNameEn} {p.lastNameEn}
                  </button>
                </TD>
                <TD dir="rtl">
                  {p.firstNameAr} {p.lastNameAr}
                </TD>
                <TD className="font-mono text-xs" dir="ltr">
                  {p.phone || '—'}
                </TD>
                <TD className="font-mono text-xs" dir="ltr">
                  {p.phoneAlt || '—'}
                </TD>
                <TD className="font-mono text-xs" dir="ltr">
                  {p.email || '—'}
                </TD>
                <TD className="font-mono text-xs text-muted-foreground">{p.nationalId || '—'}</TD>
                <TD>{p.occupation || '—'}</TD>
                <TD className="text-end">
                  <span className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                      {t('people.edit')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void remove(p.id)}>
                      {t('common.delete')}
                    </Button>
                  </span>
                </TD>
              </TR>
            ))}
            {parents.length === 0 ? (
              <TR>
                <TD colSpan={8}>
                  <EmptyState title={t('people.noParents')} />
                </TD>
              </TR>
            ) : null}
          </TBody>
        </Table>
      </div>
      {viewing ? (
        <ParentProfileDialog
          parent={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing(viewing);
            setViewing(null);
          }}
        />
      ) : null}
      {editing ? (
        <ParentEditDialog
          parent={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      ) : null}
    </Shell>
  );
}

function ParentForm({
  onDone,
  onError,
}: {
  onDone: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState<CreateParentInput>(EMPTY);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof CreateParentInput>(key: K, value: CreateParentInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: CreateParentInput = {
        firstNameEn: form.firstNameEn,
        lastNameEn: form.lastNameEn,
        firstNameAr: form.firstNameAr,
        lastNameAr: form.lastNameAr,
        phone: form.phone,
      };
      if (form.phoneAlt) payload.phoneAlt = form.phoneAlt;
      if (form.email) payload.email = form.email;
      if (form.nationalId) payload.nationalId = form.nationalId;
      if (form.occupation) payload.occupation = form.occupation;
      await parentsApi.create(payload);
      setForm(EMPTY);
      await onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-2 sm:grid-cols-2">
      <Field label={t('common.firstNameEn')} htmlFor="parent-firstNameEn">
        <Input
          id="parent-firstNameEn"
          placeholder={t('common.firstNameEn')}
          value={form.firstNameEn}
          onChange={(e) => set('firstNameEn', e.target.value)}
          required
        />
      </Field>
      <Field label={t('common.lastNameEn')} htmlFor="parent-lastNameEn">
        <Input
          id="parent-lastNameEn"
          placeholder={t('common.lastNameEn')}
          value={form.lastNameEn}
          onChange={(e) => set('lastNameEn', e.target.value)}
          required
        />
      </Field>
      <Field label="الاسم (AR)" htmlFor="parent-firstNameAr">
        <Input
          id="parent-firstNameAr"
          placeholder="الاسم (AR)"
          value={form.firstNameAr}
          onChange={(e) => set('firstNameAr', e.target.value)}
          required
          dir="rtl"
        />
      </Field>
      <Field label="العائلة (AR)" htmlFor="parent-lastNameAr">
        <Input
          id="parent-lastNameAr"
          placeholder="العائلة (AR)"
          value={form.lastNameAr}
          onChange={(e) => set('lastNameAr', e.target.value)}
          required
          dir="rtl"
        />
      </Field>
      <Field label={t('common.phone')} htmlFor="parent-phone">
        <Input
          id="parent-phone"
          placeholder={t('common.phone')}
          value={form.phone ?? ''}
          onChange={(e) => set('phone', e.target.value)}
          dir="ltr"
          required
        />
      </Field>
      <Field label={t('common.phoneAlt')} htmlFor="parent-phoneAlt">
        <Input
          id="parent-phoneAlt"
          placeholder={t('common.phoneAlt')}
          value={form.phoneAlt ?? ''}
          onChange={(e) => set('phoneAlt', e.target.value)}
          dir="ltr"
        />
      </Field>
      <Field label={t('common.email')} htmlFor="parent-email">
        <Input
          id="parent-email"
          type="email"
          placeholder={t('common.email')}
          value={form.email ?? ''}
          onChange={(e) => set('email', e.target.value)}
          dir="ltr"
        />
      </Field>
      <Field label={t('people.nationalId')} htmlFor="parent-nationalId">
        <Input
          id="parent-nationalId"
          placeholder={t('people.nationalId')}
          value={form.nationalId ?? ''}
          onChange={(e) => set('nationalId', e.target.value)}
        />
      </Field>
      <Field label={t('people.occupation')} htmlFor="parent-occupation" className="sm:col-span-2">
        <Input
          id="parent-occupation"
          placeholder={t('people.occupation')}
          value={form.occupation ?? ''}
          onChange={(e) => set('occupation', e.target.value)}
        />
      </Field>
      <Button type="submit" className="sm:col-span-2" disabled={busy}>
        {busy ? t('common.adding') : t('people.addParentButton')}
      </Button>
    </form>
  );
}
