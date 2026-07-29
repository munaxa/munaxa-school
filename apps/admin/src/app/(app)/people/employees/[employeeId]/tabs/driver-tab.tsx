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
  driverProfileApi,
  INFRACTION_SEVERITIES,
  type DriverProfile,
  type UpsertDriverProfileInput,
} from '@/lib/people';

export function DriverTab({ employeeId, canManage }: { employeeId: string; canManage: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setProfile(await driverProfileApi.get(employeeId));
    } catch {
      setProfile(null); // 404 → not a driver yet
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function makeDriver() {
    setCreating(true);
    try {
      setProfile(await driverProfileApi.upsert(employeeId, {}));
      toast.success(t('hr.driverCreated'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
  }

  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('hr.driverProfile')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('hr.notADriver')}</p>
          {canManage ? (
            <Button size="sm" onClick={() => void makeDriver()} disabled={creating}>
              {t('hr.makeDriver')}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <ProfileCard
        profile={profile}
        employeeId={employeeId}
        canManage={canManage}
        onSaved={setProfile}
      />
      <InfractionsCard
        profile={profile}
        employeeId={employeeId}
        canManage={canManage}
        onChanged={load}
      />
    </div>
  );
}

function ProfileCard({
  profile,
  employeeId,
  canManage,
  onSaved,
}: {
  profile: DriverProfile;
  employeeId: string;
  canManage: boolean;
  onSaved: (p: DriverProfile) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState({
    licenseNumber: profile.licenseNumber ?? '',
    licenseClass: profile.licenseClass ?? '',
    licenseExpiry: (profile.licenseExpiry ?? '').slice(0, 10),
    medicalCertExpiry: (profile.medicalCertExpiry ?? '').slice(0, 10),
    performanceRating: profile.performanceRating != null ? String(profile.performanceRating) : '',
    notes: profile.notes ?? '',
  });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    setBusy(true);
    try {
      const payload: UpsertDriverProfileInput = {};
      if (form.licenseNumber.trim()) payload.licenseNumber = form.licenseNumber.trim();
      if (form.licenseClass.trim()) payload.licenseClass = form.licenseClass.trim();
      if (form.licenseExpiry) payload.licenseExpiry = form.licenseExpiry;
      if (form.medicalCertExpiry) payload.medicalCertExpiry = form.medicalCertExpiry;
      if (form.performanceRating) payload.performanceRating = Number(form.performanceRating);
      if (form.notes.trim()) payload.notes = form.notes.trim();
      onSaved(await driverProfileApi.upsert(employeeId, payload));
      toast.success(t('common.saved'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('hr.driverProfile')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('hr.licenseNumber')}>
            <Input
              value={form.licenseNumber}
              onChange={(e) => set({ licenseNumber: e.target.value })}
              disabled={!canManage}
            />
          </Field>
          <Field label={t('hr.licenseClass')}>
            <Input
              value={form.licenseClass}
              onChange={(e) => set({ licenseClass: e.target.value })}
              disabled={!canManage}
            />
          </Field>
          <Field label={t('hr.licenseExpiry')}>
            <Input
              type="date"
              dir="ltr"
              value={form.licenseExpiry}
              onChange={(e) => set({ licenseExpiry: e.target.value })}
              disabled={!canManage}
            />
          </Field>
          <Field label={t('hr.medicalCertExpiry')}>
            <Input
              type="date"
              dir="ltr"
              value={form.medicalCertExpiry}
              onChange={(e) => set({ medicalCertExpiry: e.target.value })}
              disabled={!canManage}
            />
          </Field>
          <Field label={t('hr.performanceRating')}>
            <Select
              value={form.performanceRating}
              onChange={(e) => set({ performanceRating: e.target.value })}
              disabled={!canManage}
            >
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('common.reason')}>
            <Input
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              disabled={!canManage}
            />
          </Field>
        </div>
        {canManage ? (
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={() => void save()} disabled={busy}>
              {busy ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function InfractionsCard({
  profile,
  employeeId,
  canManage,
  onChanged,
}: {
  profile: DriverProfile;
  employeeId: string;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const EMPTY = { date: '', type: '', description: '', severity: 'MINOR', points: '' };
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!form.date || !form.type.trim()) return;
    setBusy(true);
    try {
      await driverProfileApi.addInfraction(employeeId, {
        date: form.date,
        type: form.type.trim(),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        severity: form.severity as (typeof INFRACTION_SEVERITIES)[number],
        ...(form.points ? { points: Number(form.points) } : {}),
      });
      setForm(EMPTY);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!(await confirm())) return;
    try {
      await driverProfileApi.removeInfraction(employeeId, id);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('hr.infractions')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={t('hr.date')}>
              <Input
                type="date"
                dir="ltr"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Field>
            <Field label={t('hr.infractionType')}>
              <Input
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                placeholder="Speeding"
              />
            </Field>
            <Field label={t('hr.severity')}>
              <Select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
              >
                {INFRACTION_SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {t(`hr.severityLevel.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('hr.points')}>
              <Input
                type="number"
                dir="ltr"
                min={0}
                value={form.points}
                onChange={(e) => setForm({ ...form, points: e.target.value })}
              />
            </Field>
            <Field label={t('common.reason')} className="sm:col-span-2">
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <div className="sm:col-span-2 flex justify-end">
              <Button
                size="sm"
                onClick={() => void add()}
                disabled={busy || !form.date || !form.type.trim()}
              >
                {t('common.add')}
              </Button>
            </div>
          </div>
        ) : null}

        {profile.infractions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('hr.noInfractions')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {profile.infractions.map((inf) => (
              <li key={inf.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{inf.type}</span>
                  <Badge
                    tone={
                      inf.severity === 'SEVERE'
                        ? 'danger'
                        : inf.severity === 'MAJOR'
                          ? 'warning'
                          : 'muted'
                    }
                    className="ms-2"
                  >
                    {t(`hr.severityLevel.${inf.severity}`)}
                  </Badge>
                  <span className="block text-xs text-muted-foreground">
                    {inf.date.slice(0, 10)}
                    {inf.points != null ? ` · ${inf.points} ${t('hr.points')}` : ''}
                    {inf.description ? ` · ${inf.description}` : ''}
                  </span>
                </div>
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => void remove(inf.id)}
                  >
                    {t('common.delete')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
