'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Field,
  Input,
  Select,
  Table,
  TBody,
  TD,
  Textarea,
  TH,
  THead,
  TimePicker,
  TR,
  useToast,
} from '@axa/platform';
import { useI18n } from '@/components/i18n-provider';
import { busApi, driversApi, type Bus, type BusRoute, type DriverListRow } from '@/lib/bus';
import { areasApi, type Area } from '@/lib/areas';
import { type AcademicYear } from '@/lib/structure';
import type { TransportData } from './lib';

/** Setup — preserved Routes & Buses configuration (the original /fleet CRUD). */
export function Setup({ data, canManage }: { data: TransportData; canManage: boolean }) {
  const currentYearIds = useMemo(
    () => new Set(data.years.filter((y) => y.isCurrent).map((y) => y.id)),
    [data.years],
  );
  const yearName = (id: string | null) =>
    id ? (data.years.find((y) => y.id === id)?.name ?? id) : null;
  const routeName = (id: string) => data.routes.find((r) => r.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <RoutesCard
          routes={data.routes}
          years={data.years}
          yearName={yearName}
          canManage={canManage}
          onSaved={(r, isNew) =>
            data.setRoutes((prev) =>
              isNew ? [...prev, r] : prev.map((x) => (x.id === r.id ? r : x)),
            )
          }
        />
        <BusesCard
          buses={data.buses}
          routes={data.routes}
          routeName={routeName}
          currentYearIds={currentYearIds}
          canManage={canManage}
          onSaved={(b) =>
            data.setBuses((prev) =>
              prev.some((x) => x.id === b.id)
                ? prev.map((x) => (x.id === b.id ? b : x))
                : [...prev, b],
            )
          }
        />
      </div>
      <AreasCard
        areas={data.areaMaster}
        routes={data.routes}
        canManage={canManage}
        onSaved={(a) =>
          data.setAreaMaster((prev) =>
            prev.some((x) => x.id === a.id)
              ? prev.map((x) => (x.id === a.id ? a : x))
              : [...prev, a],
          )
        }
      />
    </div>
  );
}

function AreasCard({
  areas,
  routes,
  canManage,
  onSaved,
}: {
  areas: Area[];
  routes: BusRoute[];
  canManage: boolean;
  onSaved: (a: Area) => void;
}) {
  const toast = useToast();
  const { t } = useI18n();
  const EMPTY = {
    name: '',
    notes: '',
    routeId: '',
    transportFee: '',
    transportationAvailable: true,
    active: true,
  };
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const routeNameById = (id: string | null) =>
    id ? (routes.find((r) => r.id === id)?.name ?? id) : null;

  function reset() {
    setEditingId(null);
    setForm(EMPTY);
  }
  function startEdit(a: Area) {
    setEditingId(a.id);
    setForm({
      name: a.name,
      notes: a.notes ?? '',
      routeId: a.routeId ?? '',
      transportFee: a.transportFee ?? '',
      transportationAvailable: a.transportationAvailable,
      active: a.active,
    });
  }

  async function save() {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const name = form.name.trim();
      const notes = form.notes.trim();
      const fee = form.transportFee.trim();
      const a = editingId
        ? await areasApi.update(editingId, {
            name,
            notes,
            routeId: form.routeId,
            ...(fee ? { transportFee: Number(fee) } : {}),
            transportationAvailable: form.transportationAvailable,
            active: form.active,
          })
        : await areasApi.create({
            name,
            transportationAvailable: form.transportationAvailable,
            active: form.active,
            ...(form.routeId ? { routeId: form.routeId } : {}),
            ...(fee ? { transportFee: Number(fee) } : {}),
            ...(notes ? { notes } : {}),
          });
      onSaved(a);
      reset();
      toast.success(editingId ? 'Area updated' : 'Area created');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save area');
    } finally {
      setBusy(false);
    }
  }

  // Archive = soft-disable (active=false). Areas are never hard-deleted (students reference them).
  async function archive(a: Area) {
    try {
      const updated = await areasApi.update(a.id, { active: !a.active });
      onSaved(updated);
      toast.success(a.active ? 'Area archived' : 'Area restored');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update area');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('transport.area.master')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('transport.area.masterDesc')}</p>
        {canManage ? (
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t('fleet.name')} className="flex-1 min-w-36">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Khalda"
              />
            </Field>
            <Field label={t('transport.area.route')} className="min-w-40">
              <Select
                value={form.routeId}
                onChange={(e) => setForm({ ...form, routeId: e.target.value })}
              >
                <option value="">{t('transport.area.noRouteMapped')}</option>
                {routes
                  .filter((r) => !r.disabledAt || r.id === form.routeId)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label={t('transport.area.feeOverride')}>
              <Input
                type="number"
                step="0.001"
                dir="ltr"
                value={form.transportFee}
                onChange={(e) => setForm({ ...form, transportFee: e.target.value })}
                placeholder={t('transport.area.feeDefault')}
              />
            </Field>
            <Checkbox
              label={t('transport.area.transportAvailable')}
              checked={form.transportationAvailable}
              onChange={(e) => setForm({ ...form, transportationAvailable: e.target.checked })}
            />
            <Checkbox
              label={t('transport.area.activeLabel')}
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            {editingId ? (
              <Button size="sm" variant="outline" onClick={reset} disabled={busy}>
                {t('common.cancel')}
              </Button>
            ) : null}
            <Button size="sm" onClick={() => void save()} disabled={busy || !form.name.trim()}>
              {editingId ? t('common.save') : t('common.add')}
            </Button>
          </div>
        ) : null}
        {areas.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('transport.area.noneYet')}</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t('fleet.name')}</TH>
                <TH>{t('transport.area.route')}</TH>
                <TH className="text-end">{t('transport.area.studentsCount')}</TH>
                <TH className="text-end">{t('transport.area.fee')}</TH>
                <TH>{t('transport.area.activeLabel')}</TH>
                {canManage ? <TH className="text-end">{t('common.actions')}</TH> : null}
              </TR>
            </THead>
            <TBody>
              {areas.map((a) => (
                <TR key={a.id} className={a.active ? undefined : 'opacity-60'}>
                  <TD>
                    <span className="font-medium">{a.name}</span>
                    {!a.transportationAvailable ? (
                      <Badge tone="muted" className="ms-2">
                        {t('transport.area.notOffered')}
                      </Badge>
                    ) : null}
                    {a.notes ? (
                      <span className="block text-xs text-muted-foreground">{a.notes}</span>
                    ) : null}
                  </TD>
                  <TD className="text-sm">
                    {a.route?.name ?? routeNameById(a.routeId) ?? (
                      <span className="text-warning">{t('transport.area.noRouteMapped')}</span>
                    )}
                  </TD>
                  <TD className="text-end font-mono text-xs">{a.studentCount ?? 0}</TD>
                  <TD className="text-end font-mono text-xs">
                    {a.transportFee != null ? a.transportFee : '—'}
                  </TD>
                  <TD>
                    {a.active ? (
                      <Badge tone="success">{t('common.yes')}</Badge>
                    ) : (
                      <Badge tone="muted">{t('common.no')}</Badge>
                    )}
                  </TD>
                  {canManage ? (
                    <TD className="text-end">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(a)}>
                        {t('common.edit')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void archive(a)}>
                        {a.active ? t('transport.area.archive') : t('transport.area.restore')}
                      </Button>
                    </TD>
                  ) : null}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function RoutesCard({
  routes,
  years,
  yearName,
  canManage,
  onSaved,
}: {
  routes: BusRoute[];
  years: AcademicYear[];
  yearName: (id: string | null) => string | null;
  canManage: boolean;
  onSaved: (r: BusRoute, isNew: boolean) => void;
}) {
  const toast = useToast();
  const { t } = useI18n();
  const EMPTY = { name: '', description: '', academicYearId: '', round1Time: '', round2Time: '' };
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setEditingId(null);
    setForm(EMPTY);
  }
  function startEdit(r: BusRoute) {
    setEditingId(r.id);
    setForm({
      name: r.name,
      description: r.description ?? '',
      academicYearId: r.academicYearId ?? '',
      round1Time: r.round1Time ?? '',
      round2Time: r.round2Time ?? '',
    });
  }

  async function save() {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const name = form.name.trim();
      const description = form.description.trim();
      const r = editingId
        ? await busApi.updateRoute(editingId, {
            name,
            description,
            academicYearId: form.academicYearId || null,
            round1Time: form.round1Time,
            round2Time: form.round2Time,
          })
        : await busApi.createRoute({
            name,
            ...(description ? { description } : {}),
            ...(form.academicYearId ? { academicYearId: form.academicYearId } : {}),
            ...(form.round1Time ? { round1Time: form.round1Time } : {}),
            ...(form.round2Time ? { round2Time: form.round2Time } : {}),
          });
      onSaved(r, !editingId);
      reset();
      toast.success(editingId ? 'Route updated' : 'Route created');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save route');
    } finally {
      setBusy(false);
    }
  }

  async function toggleDisabled(r: BusRoute) {
    try {
      const updated = await busApi.updateRoute(r.id, { disabled: !r.disabledAt });
      onSaved(updated, false);
      toast.success(r.disabledAt ? 'Route enabled' : 'Route disabled');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update route');
    }
  }

  const groups = useMemo(() => {
    const byYear = new Map<string, BusRoute[]>();
    for (const r of routes) {
      const key = r.academicYearId ?? '';
      const list = byYear.get(key) ?? [];
      list.push(r);
      byYear.set(key, list);
    }
    return [...byYear.entries()]
      .map(([yid, list]) => ({ yid, label: yearName(yid || null) ?? 'No academic year', list }))
      .sort((a, b) => (a.yid === '' ? 1 : b.yid === '' ? -1 : b.label.localeCompare(a.label)));
  }, [routes, yearName]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('fleet.routes')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage ? (
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t('fleet.name')} className="flex-1">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="North Amman"
              />
            </Field>
            <Field label={t('fleet.description')} className="w-full">
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional notes about this route…"
              />
            </Field>
            <Field label={t('fleet.academicYear')}>
              <Select
                value={form.academicYearId}
                onChange={(e) => setForm({ ...form, academicYearId: e.target.value })}
              >
                <option value="">{t('fleet.noYear')}</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('fleet.round1')}>
              <TimePicker
                value={form.round1Time}
                onChange={(value) => setForm({ ...form, round1Time: value })}
              />
            </Field>
            <Field label={t('fleet.round2')}>
              <TimePicker
                value={form.round2Time}
                onChange={(value) => setForm({ ...form, round2Time: value })}
              />
            </Field>
            {editingId ? (
              <Button size="sm" variant="outline" onClick={reset} disabled={busy}>
                {t('common.cancel')}
              </Button>
            ) : null}
            <Button size="sm" onClick={() => void save()} disabled={busy || !form.name.trim()}>
              {editingId ? t('common.save') : t('common.add')}
            </Button>
          </div>
        ) : null}
        {routes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('fleet.noRoutes')}</p>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.yid || 'none'}>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.label}
                </h4>
                <ul className="space-y-1 text-sm">
                  {g.list.map((r) => (
                    <li
                      key={r.id}
                      className={`flex items-center gap-2 border-b border-border pb-1 last:border-0 ${
                        r.disabledAt ? 'opacity-60' : ''
                      }`}
                    >
                      <span className="font-medium">{r.name}</span>
                      {r.disabledAt ? <Badge tone="muted">{t('fleet.disabled')}</Badge> : null}
                      {r.description ? (
                        <span className="text-xs text-muted-foreground">{r.description}</span>
                      ) : null}
                      {r.round1Time || r.round2Time ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          {[r.round1Time, r.round2Time].filter(Boolean).join(' · ')}
                        </span>
                      ) : null}
                      {canManage ? (
                        <span className="ms-auto flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(r)}>
                            {t('common.edit')}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => void toggleDisabled(r)}>
                            {r.disabledAt ? t('fleet.enable') : t('fleet.disable')}
                          </Button>
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BusesCard({
  buses,
  routes,
  routeName,
  currentYearIds,
  canManage,
  onSaved,
}: {
  buses: Bus[];
  routes: BusRoute[];
  routeName: (id: string) => string;
  currentYearIds: Set<string>;
  canManage: boolean;
  onSaved: (b: Bus) => void;
}) {
  const toast = useToast();
  const { t } = useI18n();
  const EMPTY = {
    plateNumber: '',
    busNumber: '',
    routeId: '',
    tripRound: '',
    capacity: '',
    driverId: '',
  };
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<DriverListRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    driversApi
      .list()
      .then(setDrivers)
      .catch(() => setDrivers([]));
  }, []);

  const selectedDriver = useMemo(
    () => drivers.find((d) => d.employeeId === form.driverId) ?? null,
    [drivers, form.driverId],
  );

  const routeOptions = useMemo(
    () =>
      routes.filter(
        (r) => (r.academicYearId && currentYearIds.has(r.academicYearId)) || r.id === form.routeId,
      ),
    [routes, currentYearIds, form.routeId],
  );

  function reset() {
    setEditingId(null);
    setForm(EMPTY);
  }
  function startEdit(b: Bus) {
    setEditingId(b.id);
    setForm({
      plateNumber: b.plateNumber,
      busNumber: b.label ?? '',
      routeId: b.routeId ?? '',
      tripRound: b.tripRound != null ? String(b.tripRound) : '',
      capacity: b.capacity != null ? String(b.capacity) : '',
      driverId: b.driverId ?? '',
    });
  }

  async function save() {
    if (!form.plateNumber.trim()) return;
    setBusy(true);
    try {
      const busNumber = form.busNumber.trim();
      const payload = {
        plateNumber: form.plateNumber.trim(),
        ...(form.capacity ? { capacity: Number(form.capacity) } : {}),
      };
      const tripRound = form.routeId && form.tripRound ? Number(form.tripRound) : null;
      const b = editingId
        ? await busApi.updateBus(editingId, {
            ...payload,
            routeId: form.routeId || null,
            tripRound,
            label: busNumber,
            driverId: form.driverId || null,
          })
        : await busApi.createBus({
            ...payload,
            ...(form.routeId ? { routeId: form.routeId } : {}),
            ...(tripRound ? { tripRound } : {}),
            ...(busNumber ? { label: busNumber } : {}),
            ...(form.driverId ? { driverId: form.driverId } : {}),
          });
      onSaved(b);
      reset();
      toast.success(editingId ? 'Bus updated' : 'Bus registered');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save bus');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('fleet.buses')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('fleet.plateNumber')}>
              <Input
                value={form.plateNumber}
                onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
                placeholder="21-12345"
              />
            </Field>
            <Field label={t('fleet.busNumber')}>
              <Input
                value={form.busNumber}
                onChange={(e) => setForm({ ...form, busNumber: e.target.value })}
                placeholder="Bus 12"
              />
            </Field>
            <Field label={t('fleet.route')}>
              <Select
                value={form.routeId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    routeId: e.target.value,
                    tripRound: e.target.value ? form.tripRound : '',
                  })
                }
              >
                <option value="">{t('fleet.unassigned')}</option>
                {routeOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('fleet.trip')}>
              <Select
                value={form.tripRound}
                onChange={(e) => setForm({ ...form, tripRound: e.target.value })}
                disabled={!form.routeId}
              >
                <option value="">{t('fleet.noTrip')}</option>
                <option value="1">{t('fleet.trip1')}</option>
                <option value="2">{t('fleet.trip2')}</option>
              </Select>
            </Field>
            <Field label={t('fleet.capacity')}>
              <Input
                type="number"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
            </Field>
            <Field label={t('fleet.driver')}>
              <Select
                value={form.driverId}
                onChange={(e) => setForm({ ...form, driverId: e.target.value })}
              >
                <option value="">{t('fleet.unassigned')}</option>
                {drivers.map((d) => (
                  <option key={d.employeeId} value={d.employeeId}>
                    {d.employee.firstNameEn} {d.employee.lastNameEn}
                    {d.employee.personalPhone ? ` · ${d.employee.personalPhone}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('fleet.driverMobile')}>
              <Input
                value={selectedDriver?.employee.personalPhone ?? ''}
                placeholder="—"
                dir="ltr"
                readOnly
                disabled
              />
            </Field>
            <div className="col-span-2 flex justify-end gap-2">
              {editingId ? (
                <Button size="sm" variant="outline" onClick={reset} disabled={busy}>
                  {t('common.cancel')}
                </Button>
              ) : null}
              <Button
                size="sm"
                onClick={() => void save()}
                disabled={busy || !form.plateNumber.trim()}
              >
                {editingId ? t('common.save') : t('fleet.registerBus')}
              </Button>
            </div>
          </div>
        ) : null}
        {buses.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('fleet.noBuses')}</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t('fleet.busNumber')}</TH>
                <TH>{t('fleet.plate')}</TH>
                <TH>{t('fleet.route')}</TH>
                <TH className="text-end">{t('fleet.capacity')}</TH>
                {canManage ? <TH className="text-end">{t('common.actions')}</TH> : null}
              </TR>
            </THead>
            <TBody>
              {buses.map((b) => (
                <TR key={b.id}>
                  <TD>{b.label || <span className="text-muted-foreground">—</span>}</TD>
                  <TD>
                    {b.plateNumber}
                    {b.driver ? (
                      <span className="block text-xs text-muted-foreground">
                        {b.driver.firstNameEn} {b.driver.lastNameEn}
                        {b.driver.personalPhone ? ` · ${b.driver.personalPhone}` : ''}
                      </span>
                    ) : null}
                  </TD>
                  <TD className="text-xs text-muted-foreground">
                    {b.routeId ? routeName(b.routeId) : '—'}
                    {b.routeId && b.tripRound ? (
                      <span className="block">
                        {b.tripRound === 1 ? t('fleet.trip1') : t('fleet.trip2')}
                      </span>
                    ) : null}
                  </TD>
                  <TD className="text-end font-mono text-xs">{b.capacity ?? '—'}</TD>
                  {canManage ? (
                    <TD className="text-end">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(b)}>
                        {t('common.edit')}
                      </Button>
                    </TD>
                  ) : null}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
