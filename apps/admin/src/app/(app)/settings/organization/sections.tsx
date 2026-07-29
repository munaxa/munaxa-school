'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  Spinner,
  Switch,
  Textarea,
  useToast,
} from '@axa/platform';
import { useI18n } from '@/components/i18n-provider';
import {
  ACCEPTED_IMAGE_TYPES,
  organizationApi,
  type AssetSlot,
  type OrganizationSettings,
} from '@/lib/organization';

// ── Shared helpers ───────────────────────────────────────────────────────────

export interface SectionProps {
  settings: OrganizationSettings;
  onSaved: (next: OrganizationSettings) => void;
  canEdit: boolean;
}

/** Local editable draft over a stable initial slice; resets whenever the slice changes (after save). */
function useDraft<T extends object>(initial: T) {
  const [draft, setDraft] = useState<T>(initial);
  useEffect(() => {
    setDraft(initial);
  }, [initial]);
  const set = <K extends keyof T>(key: K, value: T[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const reset = () => setDraft(initial);
  return { draft, set, setDraft, dirty, reset };
}

/** Card wrapper with a save/reset footer wired to a section save handler. */
function SectionShell({
  title,
  description,
  dirty,
  reset,
  save,
  canEdit,
  children,
}: {
  title: string;
  description?: string;
  dirty: boolean;
  reset: () => void;
  save: () => Promise<OrganizationSettings>;
  canEdit: boolean;
  children: React.ReactNode;
}) {
  const toast = useToast();
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);

  async function onSave() {
    setSaving(true);
    try {
      await save();
      toast.success(t('organization.saved'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('organization.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-5">
        {children}
        {canEdit ? (
          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            {dirty ? <Badge tone="warning">{t('organization.unsaved')}</Badge> : null}
            <Button variant="ghost" onClick={reset} disabled={!dirty || saving}>
              {t('organization.reset')}
            </Button>
            <Button onClick={() => void onSave()} disabled={!dirty || saving}>
              {saving ? <Spinner /> : null}
              {t('organization.save')}
            </Button>
          </div>
        ) : (
          <p className="border-t border-border pt-4 text-xs text-muted-foreground">
            {t('organization.readOnly')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** A labelled enable/disable toggle row (used for every optional feature). */
function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled ?? false}
        aria-label={label}
      />
    </div>
  );
}

const NULLABLE = (v: string) => (v.trim() === '' ? null : v);

// ── Asset uploader ───────────────────────────────────────────────────────────

function AssetUploader({
  slot,
  label,
  currentUrl,
  onChanged,
  canEdit,
}: {
  slot: AssetSlot;
  label: string;
  currentUrl?: string | undefined;
  onChanged: (next: OrganizationSettings) => void;
  canEdit: boolean;
}) {
  const toast = useToast();
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      onChanged(await organizationApi.uploadAsset(slot, file));
      toast.success(t('organization.uploaded'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('organization.uploadFailed'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function onRemove() {
    setBusy(true);
    try {
      onChanged(await organizationApi.removeAsset(slot));
      toast.success(t('organization.removed'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('organization.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt={label}
            className="max-h-full max-w-full object-contain"
            loading="lazy"
          />
        ) : (
          <span className="px-1 text-center text-[10px] text-muted-foreground">
            {t('organization.noImage')}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{t('organization.imageHint')}</p>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            className="hidden"
            onChange={(e) => void onPick(e.target.files?.[0])}
            disabled={!canEdit || busy}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={!canEdit || busy}
          >
            {busy ? <Spinner /> : null}
            {currentUrl ? t('organization.replace') : t('organization.upload')}
          </Button>
          {currentUrl ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void onRemove()}
              disabled={!canEdit || busy}
            >
              {t('organization.remove')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── General ──────────────────────────────────────────────────────────────────

const SCHOOL_TYPES = ['PRIVATE', 'INTERNATIONAL', 'NATIONAL', 'IB', 'BRITISH', 'AMERICAN', 'OTHER'];

export function GeneralSection({ settings, onSaved, canEdit }: SectionProps) {
  const { t } = useI18n();
  const initial = useMemo(
    () => ({
      nameEn: settings.nameEn ?? '',
      nameAr: settings.nameAr ?? '',
      legalName: settings.legalName ?? '',
      shortName: settings.shortName ?? '',
      schoolCode: settings.schoolCode ?? '',
      ministryNumber: settings.ministryNumber ?? '',
      schoolType: settings.schoolType,
      motto: settings.motto ?? '',
      mission: settings.mission ?? '',
      vision: settings.vision ?? '',
      establishedYear: settings.establishedYear?.toString() ?? '',
      description: settings.description ?? '',
      timezone: settings.timezone,
      defaultLanguage: settings.defaultLanguage,
    }),
    [settings],
  );
  const { draft, set, dirty, reset } = useDraft(initial);

  const save = () =>
    organizationApi
      .general({
        nameEn: NULLABLE(draft.nameEn),
        nameAr: NULLABLE(draft.nameAr),
        legalName: NULLABLE(draft.legalName),
        shortName: NULLABLE(draft.shortName),
        schoolCode: NULLABLE(draft.schoolCode),
        ministryNumber: NULLABLE(draft.ministryNumber),
        schoolType: draft.schoolType,
        motto: NULLABLE(draft.motto),
        mission: NULLABLE(draft.mission),
        vision: NULLABLE(draft.vision),
        establishedYear: draft.establishedYear ? Number(draft.establishedYear) : null,
        description: NULLABLE(draft.description),
        timezone: draft.timezone,
        defaultLanguage: draft.defaultLanguage,
      })
      .then((next) => {
        onSaved(next);
        return next;
      });

  return (
    <SectionShell
      title={t('organization.general')}
      description={t('organization.generalDesc')}
      dirty={dirty}
      reset={reset}
      save={save}
      canEdit={canEdit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('organization.nameEn')}>
          <Input
            value={draft.nameEn}
            onChange={(e) => set('nameEn', e.target.value)}
            disabled={!canEdit}
            dir="ltr"
          />
        </Field>
        <Field label={t('organization.nameAr')}>
          <Input
            value={draft.nameAr}
            onChange={(e) => set('nameAr', e.target.value)}
            disabled={!canEdit}
            dir="rtl"
          />
        </Field>
        <Field label={t('organization.legalName')}>
          <Input
            value={draft.legalName}
            onChange={(e) => set('legalName', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label={t('organization.shortName')}>
          <Input
            value={draft.shortName}
            onChange={(e) => set('shortName', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label={t('organization.schoolCode')}>
          <Input
            value={draft.schoolCode}
            onChange={(e) => set('schoolCode', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label={t('organization.ministryNumber')}>
          <Input
            value={draft.ministryNumber}
            onChange={(e) => set('ministryNumber', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label={t('organization.schoolType')}>
          <Select
            value={draft.schoolType}
            onChange={(e) => set('schoolType', e.target.value as typeof draft.schoolType)}
            disabled={!canEdit}
          >
            {SCHOOL_TYPES.map((s) => (
              <option key={s} value={s}>
                {t(`organization.schoolType_${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('organization.establishedYear')}>
          <Input
            type="number"
            value={draft.establishedYear}
            onChange={(e) => set('establishedYear', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label={t('organization.timezone')}>
          <Input
            value={draft.timezone}
            onChange={(e) => set('timezone', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label={t('organization.defaultLanguage')}>
          <Select
            value={draft.defaultLanguage}
            onChange={(e) => set('defaultLanguage', e.target.value)}
            disabled={!canEdit}
          >
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </Select>
        </Field>
      </div>
      <Field label={t('organization.motto')}>
        <Input
          value={draft.motto}
          onChange={(e) => set('motto', e.target.value)}
          disabled={!canEdit}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('organization.mission')}>
          <Textarea
            value={draft.mission}
            onChange={(e) => set('mission', e.target.value)}
            disabled={!canEdit}
            rows={3}
          />
        </Field>
        <Field label={t('organization.vision')}>
          <Textarea
            value={draft.vision}
            onChange={(e) => set('vision', e.target.value)}
            disabled={!canEdit}
            rows={3}
          />
        </Field>
      </div>
      <Field label={t('organization.description')}>
        <Textarea
          value={draft.description}
          onChange={(e) => set('description', e.target.value)}
          disabled={!canEdit}
          rows={3}
        />
      </Field>
    </SectionShell>
  );
}

// ── Branding ─────────────────────────────────────────────────────────────────

const ALIGNMENTS = ['LEFT', 'CENTER', 'RIGHT'];
const WATERMARK_SOURCES = ['LOGO', 'SCHOOL_NAME', 'CONFIDENTIAL'];
const LOGO_PLACEMENTS = [
  'reports',
  'certificates',
  'studentCards',
  'parentPortal',
  'mobileApp',
  'login',
] as const;

export function BrandingSection({ settings, onSaved, canEdit }: SectionProps) {
  const { t } = useI18n();
  const wm = settings.watermark ?? {};
  const lv = settings.logoVisibility ?? {};
  const initial = useMemo(
    () => ({
      logoEnabled: settings.logoEnabled,
      darkLogoEnabled: settings.darkLogoEnabled,
      smallLogoEnabled: settings.smallLogoEnabled,
      watermarkEnabled: settings.watermarkEnabled,
      stampEnabled: settings.stampEnabled,
      signatureEnabled: settings.signatureEnabled,
      stampPlacement: settings.stampPlacement,
      signaturePosition: settings.signaturePosition,
      watermarkSource: wm.source ?? 'LOGO',
      watermarkText: wm.text ?? '',
      watermarkOpacity: (wm.opacity ?? 0.1).toString(),
      watermarkScale: (wm.scale ?? 1).toString(),
      watermarkRotation: (wm.rotation ?? 0).toString(),
      logoVisibility: {
        reports: lv.reports ?? false,
        certificates: lv.certificates ?? false,
        studentCards: lv.studentCards ?? false,
        parentPortal: lv.parentPortal ?? false,
        mobileApp: lv.mobileApp ?? false,
        login: lv.login ?? false,
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings],
  );
  const { draft, set, setDraft, dirty, reset } = useDraft(initial);

  const save = () =>
    organizationApi
      .branding({
        logoEnabled: draft.logoEnabled,
        darkLogoEnabled: draft.darkLogoEnabled,
        smallLogoEnabled: draft.smallLogoEnabled,
        watermarkEnabled: draft.watermarkEnabled,
        stampEnabled: draft.stampEnabled,
        signatureEnabled: draft.signatureEnabled,
        stampPlacement: draft.stampPlacement,
        signaturePosition: draft.signaturePosition,
        logoVisibility: draft.logoVisibility,
        watermark: {
          source: draft.watermarkSource as 'LOGO',
          text: NULLABLE(draft.watermarkText) ?? undefined,
          opacity: Number(draft.watermarkOpacity),
          scale: Number(draft.watermarkScale),
          rotation: Number(draft.watermarkRotation),
        },
      })
      .then((next) => {
        onSaved(next);
        return next;
      });

  return (
    <SectionShell
      title={t('organization.branding')}
      description={t('organization.brandingDesc')}
      dirty={dirty}
      reset={reset}
      save={save}
      canEdit={canEdit}
    >
      {/* Logo */}
      <div className="space-y-3">
        <ToggleRow
          label={t('organization.enableLogo')}
          hint={t('organization.enableLogoHint')}
          checked={draft.logoEnabled}
          onChange={(v) => set('logoEnabled', v)}
          disabled={!canEdit}
        />
        {draft.logoEnabled ? (
          <>
            <AssetUploader
              slot="logo"
              label={t('organization.logo')}
              currentUrl={settings.assetUrls.logo}
              onChanged={onSaved}
              canEdit={canEdit}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              {LOGO_PLACEMENTS.map((p) => (
                <ToggleRow
                  key={p}
                  label={t(`organization.showOn_${p}`)}
                  checked={draft.logoVisibility[p]}
                  onChange={(v) =>
                    setDraft((d) => ({ ...d, logoVisibility: { ...d.logoVisibility, [p]: v } }))
                  }
                  disabled={!canEdit}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {/* Dark logo */}
      <div className="space-y-3 border-t border-border pt-4">
        <ToggleRow
          label={t('organization.enableDarkLogo')}
          checked={draft.darkLogoEnabled}
          onChange={(v) => set('darkLogoEnabled', v)}
          disabled={!canEdit}
        />
        {draft.darkLogoEnabled ? (
          <AssetUploader
            slot="darkLogo"
            label={t('organization.darkLogo')}
            currentUrl={settings.assetUrls.darkLogo}
            onChanged={onSaved}
            canEdit={canEdit}
          />
        ) : null}
      </div>

      {/* Small logo */}
      <div className="space-y-3 border-t border-border pt-4">
        <ToggleRow
          label={t('organization.enableSmallLogo')}
          hint={t('organization.smallLogoHint')}
          checked={draft.smallLogoEnabled}
          onChange={(v) => set('smallLogoEnabled', v)}
          disabled={!canEdit}
        />
        {draft.smallLogoEnabled ? (
          <AssetUploader
            slot="smallLogo"
            label={t('organization.smallLogo')}
            currentUrl={settings.assetUrls.smallLogo}
            onChanged={onSaved}
            canEdit={canEdit}
          />
        ) : null}
      </div>

      {/* Watermark */}
      <div className="space-y-3 border-t border-border pt-4">
        <ToggleRow
          label={t('organization.enableWatermark')}
          checked={draft.watermarkEnabled}
          onChange={(v) => set('watermarkEnabled', v)}
          disabled={!canEdit}
        />
        {draft.watermarkEnabled ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('organization.watermarkSource')}>
              <Select
                value={draft.watermarkSource}
                onChange={(e) =>
                  set('watermarkSource', e.target.value as typeof draft.watermarkSource)
                }
                disabled={!canEdit}
              >
                {WATERMARK_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {t(`organization.watermark_${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('organization.watermarkText')}>
              <Input
                value={draft.watermarkText}
                onChange={(e) => set('watermarkText', e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label={t('organization.opacity')}>
              <Input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={draft.watermarkOpacity}
                onChange={(e) => set('watermarkOpacity', e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label={t('organization.scale')}>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                max="5"
                value={draft.watermarkScale}
                onChange={(e) => set('watermarkScale', e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label={t('organization.rotation')}>
              <Input
                type="number"
                step="1"
                min="-180"
                max="180"
                value={draft.watermarkRotation}
                onChange={(e) => set('watermarkRotation', e.target.value)}
                disabled={!canEdit}
              />
            </Field>
          </div>
        ) : null}
      </div>

      {/* Stamp */}
      <div className="space-y-3 border-t border-border pt-4">
        <ToggleRow
          label={t('organization.enableStamp')}
          checked={draft.stampEnabled}
          onChange={(v) => set('stampEnabled', v)}
          disabled={!canEdit}
        />
        {draft.stampEnabled ? (
          <>
            <AssetUploader
              slot="stamp"
              label={t('organization.stamp')}
              currentUrl={settings.assetUrls.stamp}
              onChanged={onSaved}
              canEdit={canEdit}
            />
            <Field label={t('organization.placement')}>
              <Select
                value={draft.stampPlacement}
                onChange={(e) =>
                  set('stampPlacement', e.target.value as typeof draft.stampPlacement)
                }
                disabled={!canEdit}
              >
                {ALIGNMENTS.map((a) => (
                  <option key={a} value={a}>
                    {t(`organization.align_${a}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : null}
      </div>

      {/* Signature */}
      <div className="space-y-3 border-t border-border pt-4">
        <ToggleRow
          label={t('organization.enableSignature')}
          checked={draft.signatureEnabled}
          onChange={(v) => set('signatureEnabled', v)}
          disabled={!canEdit}
        />
        {draft.signatureEnabled ? (
          <>
            <AssetUploader
              slot="signature"
              label={t('organization.signature')}
              currentUrl={settings.assetUrls.signature}
              onChanged={onSaved}
              canEdit={canEdit}
            />
            <Field label={t('organization.position')}>
              <Select
                value={draft.signaturePosition}
                onChange={(e) =>
                  set('signaturePosition', e.target.value as typeof draft.signaturePosition)
                }
                disabled={!canEdit}
              >
                {ALIGNMENTS.map((a) => (
                  <option key={a} value={a}>
                    {t(`organization.align_${a}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : null}
      </div>
    </SectionShell>
  );
}

// ── Contact ──────────────────────────────────────────────────────────────────

export function ContactSection({ settings, onSaved, canEdit }: SectionProps) {
  const { t } = useI18n();
  const initial = useMemo(
    () => ({
      phone: settings.phone ?? '',
      mobile: settings.mobile ?? '',
      whatsapp: settings.whatsapp ?? '',
      email: settings.email ?? '',
      website: settings.website ?? '',
      country: settings.country ?? '',
      city: settings.city ?? '',
      district: settings.district ?? '',
      street: settings.street ?? '',
      building: settings.building ?? '',
      postalCode: settings.postalCode ?? '',
      googleMapsUrl: settings.googleMapsUrl ?? '',
      latitude: settings.latitude?.toString() ?? '',
      longitude: settings.longitude?.toString() ?? '',
      emergencyContact: settings.emergencyContact ?? '',
      officeHours: settings.officeHours ?? '',
    }),
    [settings],
  );
  const { draft, set, dirty, reset } = useDraft(initial);

  const save = () =>
    organizationApi
      .contact({
        phone: NULLABLE(draft.phone),
        mobile: NULLABLE(draft.mobile),
        whatsapp: NULLABLE(draft.whatsapp),
        email: NULLABLE(draft.email),
        website: NULLABLE(draft.website),
        country: NULLABLE(draft.country),
        city: NULLABLE(draft.city),
        district: NULLABLE(draft.district),
        street: NULLABLE(draft.street),
        building: NULLABLE(draft.building),
        postalCode: NULLABLE(draft.postalCode),
        googleMapsUrl: NULLABLE(draft.googleMapsUrl),
        latitude: draft.latitude ? Number(draft.latitude) : null,
        longitude: draft.longitude ? Number(draft.longitude) : null,
        emergencyContact: NULLABLE(draft.emergencyContact),
        officeHours: NULLABLE(draft.officeHours),
      })
      .then((next) => {
        onSaved(next);
        return next;
      });

  const fields: [keyof typeof draft, string][] = [
    ['phone', 'organization.phone'],
    ['mobile', 'organization.mobile'],
    ['whatsapp', 'organization.whatsapp'],
    ['email', 'organization.email'],
    ['website', 'organization.website'],
    ['country', 'organization.country'],
    ['city', 'organization.city'],
    ['district', 'organization.district'],
    ['street', 'organization.street'],
    ['building', 'organization.building'],
    ['postalCode', 'organization.postalCode'],
    ['googleMapsUrl', 'organization.googleMapsUrl'],
    ['latitude', 'organization.latitude'],
    ['longitude', 'organization.longitude'],
    ['emergencyContact', 'organization.emergencyContact'],
    ['officeHours', 'organization.officeHours'],
  ];

  return (
    <SectionShell
      title={t('organization.contact')}
      description={t('organization.contactDesc')}
      dirty={dirty}
      reset={reset}
      save={save}
      canEdit={canEdit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(([k, label]) => (
          <Field key={k} label={t(label)}>
            <Input value={draft[k]} onChange={(e) => set(k, e.target.value)} disabled={!canEdit} />
          </Field>
        ))}
      </div>
    </SectionShell>
  );
}

// ── Documents ────────────────────────────────────────────────────────────────

const PAPER_SIZES = ['A4', 'LETTER', 'LEGAL'];
const QR_CONTENTS = ['DOCUMENT_NUMBER', 'STUDENT_NUMBER', 'VERIFICATION_URL', 'CUSTOM_TEXT'];

export function DocumentsSection({ settings, onSaved, canEdit }: SectionProps) {
  const { t } = useI18n();
  const d = settings.documents ?? {};
  const m = d.margins ?? {};
  const initial = useMemo(
    () => ({
      headerEnabled: settings.headerEnabled,
      footerEnabled: settings.footerEnabled,
      qrEnabled: settings.qrEnabled,
      headerHtml: d.headerHtml ?? '',
      headerAlign: d.headerAlign ?? 'CENTER',
      footerHtml: d.footerHtml ?? '',
      footerAlign: d.footerAlign ?? 'CENTER',
      logoPosition: d.logoPosition ?? 'LEFT',
      paperSize: d.paperSize ?? 'A4',
      marginTop: (m.top ?? 20).toString(),
      marginBottom: (m.bottom ?? 20).toString(),
      marginLeft: (m.left ?? 20).toString(),
      marginRight: (m.right ?? 20).toString(),
      headerHeight: (d.headerHeight ?? 80).toString(),
      footerHeight: (d.footerHeight ?? 60).toString(),
      qrContent: d.qrContent ?? 'VERIFICATION_URL',
      qrCustomText: d.qrCustomText ?? '',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings],
  );
  const { draft, set, dirty, reset } = useDraft(initial);

  const save = () =>
    organizationApi
      .documents({
        headerEnabled: draft.headerEnabled,
        footerEnabled: draft.footerEnabled,
        qrEnabled: draft.qrEnabled,
        documents: {
          headerHtml: draft.headerHtml,
          headerAlign: draft.headerAlign as 'CENTER',
          footerHtml: draft.footerHtml,
          footerAlign: draft.footerAlign as 'CENTER',
          logoPosition: draft.logoPosition as 'LEFT',
          paperSize: draft.paperSize as 'A4',
          margins: {
            top: Number(draft.marginTop),
            bottom: Number(draft.marginBottom),
            left: Number(draft.marginLeft),
            right: Number(draft.marginRight),
          },
          headerHeight: Number(draft.headerHeight),
          footerHeight: Number(draft.footerHeight),
          qrContent: draft.qrContent as 'VERIFICATION_URL',
          qrCustomText: draft.qrCustomText,
        },
      })
      .then((next) => {
        onSaved(next);
        return next;
      });

  return (
    <SectionShell
      title={t('organization.documents')}
      description={t('organization.documentsDesc')}
      dirty={dirty}
      reset={reset}
      save={save}
      canEdit={canEdit}
    >
      {/* Header */}
      <div className="space-y-3">
        <ToggleRow
          label={t('organization.enableHeader')}
          checked={draft.headerEnabled}
          onChange={(v) => set('headerEnabled', v)}
          disabled={!canEdit}
        />
        {draft.headerEnabled ? (
          <div className="grid gap-4">
            <Field label={t('organization.headerContent')}>
              <Textarea
                value={draft.headerHtml}
                onChange={(e) => set('headerHtml', e.target.value)}
                disabled={!canEdit}
                rows={3}
              />
            </Field>
            <Field label={t('organization.alignment')}>
              <Select
                value={draft.headerAlign}
                onChange={(e) => set('headerAlign', e.target.value as 'CENTER')}
                disabled={!canEdit}
              >
                {ALIGNMENTS.map((a) => (
                  <option key={a} value={a}>
                    {t(`organization.align_${a}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <div className="space-y-3 border-t border-border pt-4">
        <ToggleRow
          label={t('organization.enableFooter')}
          checked={draft.footerEnabled}
          onChange={(v) => set('footerEnabled', v)}
          disabled={!canEdit}
        />
        {draft.footerEnabled ? (
          <div className="grid gap-4">
            <Field label={t('organization.footerContent')}>
              <Textarea
                value={draft.footerHtml}
                onChange={(e) => set('footerHtml', e.target.value)}
                disabled={!canEdit}
                rows={3}
              />
            </Field>
            <Field label={t('organization.alignment')}>
              <Select
                value={draft.footerAlign}
                onChange={(e) => set('footerAlign', e.target.value as 'CENTER')}
                disabled={!canEdit}
              >
                {ALIGNMENTS.map((a) => (
                  <option key={a} value={a}>
                    {t(`organization.align_${a}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}
      </div>

      {/* Layout */}
      <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
        <Field label={t('organization.logoPosition')}>
          <Select
            value={draft.logoPosition}
            onChange={(e) => set('logoPosition', e.target.value as 'LEFT')}
            disabled={!canEdit}
          >
            {ALIGNMENTS.map((a) => (
              <option key={a} value={a}>
                {t(`organization.align_${a}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('organization.paperSize')}>
          <Select
            value={draft.paperSize}
            onChange={(e) => set('paperSize', e.target.value as 'A4')}
            disabled={!canEdit}
          >
            {PAPER_SIZES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('organization.marginTop')}>
          <Input
            type="number"
            value={draft.marginTop}
            onChange={(e) => set('marginTop', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label={t('organization.marginBottom')}>
          <Input
            type="number"
            value={draft.marginBottom}
            onChange={(e) => set('marginBottom', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label={t('organization.marginLeft')}>
          <Input
            type="number"
            value={draft.marginLeft}
            onChange={(e) => set('marginLeft', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label={t('organization.marginRight')}>
          <Input
            type="number"
            value={draft.marginRight}
            onChange={(e) => set('marginRight', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label={t('organization.headerHeight')}>
          <Input
            type="number"
            value={draft.headerHeight}
            onChange={(e) => set('headerHeight', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label={t('organization.footerHeight')}>
          <Input
            type="number"
            value={draft.footerHeight}
            onChange={(e) => set('footerHeight', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
      </div>

      {/* QR */}
      <div className="space-y-3 border-t border-border pt-4">
        <ToggleRow
          label={t('organization.enableQr')}
          checked={draft.qrEnabled}
          onChange={(v) => set('qrEnabled', v)}
          disabled={!canEdit}
        />
        {draft.qrEnabled ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('organization.qrContent')}>
              <Select
                value={draft.qrContent}
                onChange={(e) => set('qrContent', e.target.value as 'VERIFICATION_URL')}
                disabled={!canEdit}
              >
                {QR_CONTENTS.map((q) => (
                  <option key={q} value={q}>
                    {t(`organization.qr_${q}`)}
                  </option>
                ))}
              </Select>
            </Field>
            {draft.qrContent === 'CUSTOM_TEXT' ? (
              <Field label={t('organization.qrCustomText')}>
                <Input
                  value={draft.qrCustomText}
                  onChange={(e) => set('qrCustomText', e.target.value)}
                  disabled={!canEdit}
                />
              </Field>
            ) : null}
          </div>
        ) : null}
      </div>
    </SectionShell>
  );
}

// ── Communication ────────────────────────────────────────────────────────────

export function CommunicationSection({ settings, onSaved, canEdit }: SectionProps) {
  const { t } = useI18n();
  const initial = useMemo(
    () => ({
      senderName: settings.senderName ?? '',
      senderEmail: settings.senderEmail ?? '',
      replyToEmail: settings.replyToEmail ?? '',
      emailFooter: settings.emailFooter ?? '',
      notificationDisplayName: settings.notificationDisplayName ?? '',
      smsSender: settings.smsSender ?? '',
      whatsappDisplayName: settings.whatsappDisplayName ?? '',
    }),
    [settings],
  );
  const { draft, set, dirty, reset } = useDraft(initial);

  const save = () =>
    organizationApi
      .communication({
        senderName: NULLABLE(draft.senderName),
        senderEmail: NULLABLE(draft.senderEmail),
        replyToEmail: NULLABLE(draft.replyToEmail),
        emailFooter: NULLABLE(draft.emailFooter),
        notificationDisplayName: NULLABLE(draft.notificationDisplayName),
        smsSender: NULLABLE(draft.smsSender),
        whatsappDisplayName: NULLABLE(draft.whatsappDisplayName),
      })
      .then((next) => {
        onSaved(next);
        return next;
      });

  return (
    <SectionShell
      title={t('organization.communication')}
      description={t('organization.communicationDesc')}
      dirty={dirty}
      reset={reset}
      save={save}
      canEdit={canEdit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('organization.senderName')}>
          <Input
            value={draft.senderName}
            onChange={(e) => set('senderName', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label={t('organization.senderEmail')}>
          <Input
            value={draft.senderEmail}
            onChange={(e) => set('senderEmail', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label={t('organization.replyToEmail')}>
          <Input
            value={draft.replyToEmail}
            onChange={(e) => set('replyToEmail', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label={t('organization.notificationDisplayName')}>
          <Input
            value={draft.notificationDisplayName}
            onChange={(e) => set('notificationDisplayName', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label={t('organization.smsSender')}>
          <Input
            value={draft.smsSender}
            onChange={(e) => set('smsSender', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label={t('organization.whatsappDisplayName')}>
          <Input
            value={draft.whatsappDisplayName}
            onChange={(e) => set('whatsappDisplayName', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
      </div>
      <Field label={t('organization.emailFooter')}>
        <Textarea
          value={draft.emailFooter}
          onChange={(e) => set('emailFooter', e.target.value)}
          disabled={!canEdit}
          rows={3}
        />
      </Field>
      <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
        <AssetUploader
          slot="pushIcon"
          label={t('organization.pushIcon')}
          currentUrl={settings.assetUrls.pushIcon}
          onChanged={onSaved}
          canEdit={canEdit}
        />
        <AssetUploader
          slot="notificationImage"
          label={t('organization.notificationImage')}
          currentUrl={settings.assetUrls.notificationImage}
          onChanged={onSaved}
          canEdit={canEdit}
        />
      </div>
    </SectionShell>
  );
}

// ── Academic identity ────────────────────────────────────────────────────────

export function AcademicSection({ settings, onSaved, canEdit }: SectionProps) {
  const { t } = useI18n();
  const initial = useMemo(
    () => ({
      schoolType: settings.schoolType,
      curriculum: settings.curriculum ?? '',
      motto: settings.motto ?? '',
      mission: settings.mission ?? '',
      vision: settings.vision ?? '',
      academicYearFormat: settings.academicYearFormat ?? '',
      colorTheme: settings.colorTheme ?? '',
    }),
    [settings],
  );
  const { draft, set, dirty, reset } = useDraft(initial);

  const save = () =>
    organizationApi
      .academic({
        schoolType: draft.schoolType,
        curriculum: NULLABLE(draft.curriculum),
        motto: NULLABLE(draft.motto),
        mission: NULLABLE(draft.mission),
        vision: NULLABLE(draft.vision),
        academicYearFormat: NULLABLE(draft.academicYearFormat),
        colorTheme: NULLABLE(draft.colorTheme),
      })
      .then((next) => {
        onSaved(next);
        return next;
      });

  return (
    <SectionShell
      title={t('organization.academic')}
      description={t('organization.academicDesc')}
      dirty={dirty}
      reset={reset}
      save={save}
      canEdit={canEdit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('organization.schoolType')}>
          <Select
            value={draft.schoolType}
            onChange={(e) => set('schoolType', e.target.value as typeof draft.schoolType)}
            disabled={!canEdit}
          >
            {SCHOOL_TYPES.map((s) => (
              <option key={s} value={s}>
                {t(`organization.schoolType_${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('organization.curriculum')}>
          <Input
            value={draft.curriculum}
            onChange={(e) => set('curriculum', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label={t('organization.academicYearFormat')}>
          <Input
            value={draft.academicYearFormat}
            onChange={(e) => set('academicYearFormat', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label={t('organization.colorTheme')}>
          <Input
            value={draft.colorTheme}
            onChange={(e) => set('colorTheme', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
      </div>
      <Field label={t('organization.motto')}>
        <Input
          value={draft.motto}
          onChange={(e) => set('motto', e.target.value)}
          disabled={!canEdit}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('organization.mission')}>
          <Textarea
            value={draft.mission}
            onChange={(e) => set('mission', e.target.value)}
            disabled={!canEdit}
            rows={3}
          />
        </Field>
        <Field label={t('organization.vision')}>
          <Textarea
            value={draft.vision}
            onChange={(e) => set('vision', e.target.value)}
            disabled={!canEdit}
            rows={3}
          />
        </Field>
      </div>
      <div className="border-t border-border pt-4">
        <AssetUploader
          slot="banner"
          label={t('organization.banner')}
          currentUrl={settings.assetUrls.banner}
          onChanged={onSaved}
          canEdit={canEdit}
        />
      </div>
    </SectionShell>
  );
}

// ── Compliance ───────────────────────────────────────────────────────────────

export function ComplianceSection({ settings, onSaved, canEdit }: SectionProps) {
  const { t } = useI18n();
  const initial = useMemo(
    () => ({
      complianceEnabled: settings.complianceEnabled,
      legalName: settings.legalName ?? '',
      commercialRegistration: settings.commercialRegistration ?? '',
      licenseNumber: settings.licenseNumber ?? '',
      ministryLicense: settings.ministryLicense ?? '',
      taxNumber: settings.taxNumber ?? '',
      vatNumber: settings.vatNumber ?? '',
      otherGovIds: settings.otherGovIds ?? [],
    }),
    [settings],
  );
  const { draft, set, setDraft, dirty, reset } = useDraft(initial);

  const save = () =>
    organizationApi
      .compliance({
        complianceEnabled: draft.complianceEnabled,
        legalName: NULLABLE(draft.legalName),
        commercialRegistration: NULLABLE(draft.commercialRegistration),
        licenseNumber: NULLABLE(draft.licenseNumber),
        ministryLicense: NULLABLE(draft.ministryLicense),
        taxNumber: NULLABLE(draft.taxNumber),
        vatNumber: NULLABLE(draft.vatNumber),
        otherGovIds: draft.otherGovIds.filter((g) => g.label.trim() && g.value.trim()),
      })
      .then((next) => {
        onSaved(next);
        return next;
      });

  return (
    <SectionShell
      title={t('organization.compliance')}
      description={t('organization.complianceDesc')}
      dirty={dirty}
      reset={reset}
      save={save}
      canEdit={canEdit}
    >
      <ToggleRow
        label={t('organization.enableCompliance')}
        checked={draft.complianceEnabled}
        onChange={(v) => set('complianceEnabled', v)}
        disabled={!canEdit}
      />
      {draft.complianceEnabled ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('organization.legalName')}>
              <Input
                value={draft.legalName}
                onChange={(e) => set('legalName', e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label={t('organization.commercialRegistration')}>
              <Input
                value={draft.commercialRegistration}
                onChange={(e) => set('commercialRegistration', e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label={t('organization.licenseNumber')}>
              <Input
                value={draft.licenseNumber}
                onChange={(e) => set('licenseNumber', e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label={t('organization.ministryLicense')}>
              <Input
                value={draft.ministryLicense}
                onChange={(e) => set('ministryLicense', e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label={t('organization.taxNumber')}>
              <Input
                value={draft.taxNumber}
                onChange={(e) => set('taxNumber', e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label={t('organization.vatNumber')}>
              <Input
                value={draft.vatNumber}
                onChange={(e) => set('vatNumber', e.target.value)}
                disabled={!canEdit}
              />
            </Field>
          </div>
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-sm font-medium">{t('organization.otherGovIds')}</p>
            {draft.otherGovIds.map((g, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder={t('organization.govIdLabel')}
                  value={g.label}
                  onChange={(e) =>
                    setDraft((d) => {
                      const list = [...d.otherGovIds];
                      list[i] = { ...list[i]!, label: e.target.value };
                      return { ...d, otherGovIds: list };
                    })
                  }
                  disabled={!canEdit}
                />
                <Input
                  placeholder={t('organization.govIdValue')}
                  value={g.value}
                  onChange={(e) =>
                    setDraft((d) => {
                      const list = [...d.otherGovIds];
                      list[i] = { ...list[i]!, value: e.target.value };
                      return { ...d, otherGovIds: list };
                    })
                  }
                  disabled={!canEdit}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      otherGovIds: d.otherGovIds.filter((_, j) => j !== i),
                    }))
                  }
                  disabled={!canEdit}
                >
                  {t('organization.remove')}
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  otherGovIds: [...d.otherGovIds, { label: '', value: '' }],
                }))
              }
              disabled={!canEdit}
            >
              {t('organization.addGovId')}
            </Button>
          </div>
        </>
      ) : null}
    </SectionShell>
  );
}

// ── Social & website ─────────────────────────────────────────────────────────

const SOCIAL_FIELDS = [
  'website',
  'facebook',
  'instagram',
  'linkedin',
  'youtube',
  'tiktok',
  'x',
] as const;

export function SocialSection({ settings, onSaved, canEdit }: SectionProps) {
  const { t } = useI18n();
  const s = settings.social ?? {};
  const initial = useMemo(
    () => ({
      socialEnabled: settings.socialEnabled,
      website: s.website ?? '',
      facebook: s.facebook ?? '',
      instagram: s.instagram ?? '',
      linkedin: s.linkedin ?? '',
      youtube: s.youtube ?? '',
      tiktok: s.tiktok ?? '',
      x: s.x ?? '',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings],
  );
  const { draft, set, dirty, reset } = useDraft(initial);

  const save = () =>
    organizationApi
      .social({
        socialEnabled: draft.socialEnabled,
        social: {
          website: NULLABLE(draft.website) ?? undefined,
          facebook: NULLABLE(draft.facebook) ?? undefined,
          instagram: NULLABLE(draft.instagram) ?? undefined,
          linkedin: NULLABLE(draft.linkedin) ?? undefined,
          youtube: NULLABLE(draft.youtube) ?? undefined,
          tiktok: NULLABLE(draft.tiktok) ?? undefined,
          x: NULLABLE(draft.x) ?? undefined,
        },
      })
      .then((next) => {
        onSaved(next);
        return next;
      });

  return (
    <SectionShell
      title={t('organization.social')}
      description={t('organization.socialDesc')}
      dirty={dirty}
      reset={reset}
      save={save}
      canEdit={canEdit}
    >
      <ToggleRow
        label={t('organization.enableSocial')}
        hint={t('organization.enableSocialHint')}
        checked={draft.socialEnabled}
        onChange={(v) => set('socialEnabled', v)}
        disabled={!canEdit}
      />
      {draft.socialEnabled ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIAL_FIELDS.map((f) => (
            <Field key={f} label={t(`organization.social_${f}`)}>
              <Input
                value={draft[f]}
                onChange={(e) => set(f, e.target.value)}
                disabled={!canEdit}
                dir="ltr"
              />
            </Field>
          ))}
        </div>
      ) : null}
    </SectionShell>
  );
}

// ── Advanced ─────────────────────────────────────────────────────────────────

const LOGO_VARIANTS = ['PRIMARY', 'DARK', 'SMALL'];

export function AdvancedSection({ settings, onSaved, canEdit }: SectionProps) {
  const { t } = useI18n();
  const initial = useMemo(
    () => ({
      defaultReportLanguage: settings.defaultReportLanguage,
      defaultCertificateLanguage: settings.defaultCertificateLanguage,
      documentNumberPrefix: settings.documentNumberPrefix ?? '',
      defaultFont: settings.defaultFont ?? '',
      defaultReportTheme: settings.defaultReportTheme ?? '',
      defaultLogoVariant: settings.defaultLogoVariant,
      documentCompression: settings.documentCompression,
      pdfQuality: settings.pdfQuality.toString(),
      imageQuality: settings.imageQuality.toString(),
      storageOptimization: settings.storageOptimization,
    }),
    [settings],
  );
  const { draft, set, dirty, reset } = useDraft(initial);

  const save = () =>
    organizationApi
      .advanced({
        defaultReportLanguage: draft.defaultReportLanguage,
        defaultCertificateLanguage: draft.defaultCertificateLanguage,
        documentNumberPrefix: NULLABLE(draft.documentNumberPrefix),
        defaultFont: NULLABLE(draft.defaultFont),
        defaultReportTheme: NULLABLE(draft.defaultReportTheme),
        defaultLogoVariant: draft.defaultLogoVariant,
        documentCompression: draft.documentCompression,
        pdfQuality: Number(draft.pdfQuality),
        imageQuality: Number(draft.imageQuality),
        storageOptimization: draft.storageOptimization,
      })
      .then((next) => {
        onSaved(next);
        return next;
      });

  return (
    <SectionShell
      title={t('organization.advanced')}
      description={t('organization.advancedDesc')}
      dirty={dirty}
      reset={reset}
      save={save}
      canEdit={canEdit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('organization.defaultReportLanguage')}>
          <Select
            value={draft.defaultReportLanguage}
            onChange={(e) => set('defaultReportLanguage', e.target.value)}
            disabled={!canEdit}
          >
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </Select>
        </Field>
        <Field label={t('organization.defaultCertificateLanguage')}>
          <Select
            value={draft.defaultCertificateLanguage}
            onChange={(e) => set('defaultCertificateLanguage', e.target.value)}
            disabled={!canEdit}
          >
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </Select>
        </Field>
        <Field label={t('organization.documentNumberPrefix')}>
          <Input
            value={draft.documentNumberPrefix}
            onChange={(e) => set('documentNumberPrefix', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label={t('organization.defaultFont')}>
          <Input
            value={draft.defaultFont}
            onChange={(e) => set('defaultFont', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label={t('organization.defaultReportTheme')}>
          <Input
            value={draft.defaultReportTheme}
            onChange={(e) => set('defaultReportTheme', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label={t('organization.defaultLogoVariant')}>
          <Select
            value={draft.defaultLogoVariant}
            onChange={(e) =>
              set('defaultLogoVariant', e.target.value as typeof draft.defaultLogoVariant)
            }
            disabled={!canEdit}
          >
            {LOGO_VARIANTS.map((v) => (
              <option key={v} value={v}>
                {t(`organization.logoVariant_${v}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('organization.pdfQuality')}>
          <Input
            type="number"
            min="10"
            max="100"
            value={draft.pdfQuality}
            onChange={(e) => set('pdfQuality', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label={t('organization.imageQuality')}>
          <Input
            type="number"
            min="10"
            max="100"
            value={draft.imageQuality}
            onChange={(e) => set('imageQuality', e.target.value)}
            disabled={!canEdit}
          />
        </Field>
      </div>
      <div className="space-y-3 border-t border-border pt-4">
        <ToggleRow
          label={t('organization.documentCompression')}
          checked={draft.documentCompression}
          onChange={(v) => set('documentCompression', v)}
          disabled={!canEdit}
        />
        <ToggleRow
          label={t('organization.storageOptimization')}
          checked={draft.storageOptimization}
          onChange={(v) => set('storageOptimization', v)}
          disabled={!canEdit}
        />
      </div>
    </SectionShell>
  );
}
