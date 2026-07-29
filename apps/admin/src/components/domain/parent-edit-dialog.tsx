'use client';

import { useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import { Button, Field, Input, useToast } from '@axa/platform';
import { parentsApi, type Parent, type UpdateParentInput } from '@/lib/people';

/**
 * The single parent/guardian edit window, shared by the Parents tab and the student profile so
 * editing a guardian is the same experience everywhere. Edits the full contact record (names,
 * both mobiles, email, national id, occupation). Mobile is the de-duplication key, so it is
 * required and the API rejects a number already used by another (live) parent.
 */
export function ParentEditDialog({
  parent,
  onClose,
  onSaved,
}: {
  parent: Parent;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState<UpdateParentInput>({
    firstNameEn: parent.firstNameEn,
    lastNameEn: parent.lastNameEn,
    firstNameAr: parent.firstNameAr,
    lastNameAr: parent.lastNameAr,
    phone: parent.phone ?? '',
    phoneAlt: parent.phoneAlt ?? '',
    email: parent.email ?? '',
    nationalId: parent.nationalId ?? '',
    occupation: parent.occupation ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<UpdateParentInput>) => setForm((f) => ({ ...f, ...patch }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // Omit email when blank — '' fails the API's email validation.
      const payload: UpdateParentInput = { ...form };
      if (!payload.email) delete payload.email;
      await parentsApi.update(parent.id, payload);
      toast.success(t('people.parentUpdated'));
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-foreground/40" onClick={onClose} aria-hidden="true" />
      <div
        className="relative my-8 w-full max-w-xl rounded-xl border border-border bg-card p-5 shadow-card"
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{t('people.editParent')}</h2>
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
          <Field label={t('common.phone')}>
            <Input
              dir="ltr"
              value={form.phone ?? ''}
              onChange={(e) => set({ phone: e.target.value })}
              required
            />
          </Field>
          <Field label={t('common.phoneAlt')}>
            <Input
              dir="ltr"
              value={form.phoneAlt ?? ''}
              onChange={(e) => set({ phoneAlt: e.target.value })}
            />
          </Field>
          <Field label={t('common.email')}>
            <Input
              type="email"
              dir="ltr"
              value={form.email ?? ''}
              onChange={(e) => set({ email: e.target.value })}
            />
          </Field>
          <Field label={t('people.nationalId')}>
            <Input
              value={form.nationalId ?? ''}
              onChange={(e) => set({ nationalId: e.target.value })}
            />
          </Field>
          <Field label={t('people.occupation')} className="sm:col-span-2">
            <Input
              value={form.occupation ?? ''}
              onChange={(e) => set({ occupation: e.target.value })}
            />
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
      </div>
    </div>
  );
}
