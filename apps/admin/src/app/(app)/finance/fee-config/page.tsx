'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Shell } from '@/components/shell';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from '@axa/platform';
import { useConfirm } from '@/components/confirm';
import {
  feeConfigApi,
  type BillingPolicy,
  type DiscountRule,
  type GradeFeeSchedule,
  type TransportFare,
} from '@/lib/finance';
import { schoolsApi, campusesApi, gradesApi, academicYearsApi } from '@/lib/structure';
import type { AcademicYear, Campus, Grade } from '@/lib/structure';
import { busApi, type BusRoute } from '@/lib/bus';

const jod = (v: string | number) => `${Number(v).toFixed(3)} JOD`;

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
      }`}
    >
      {active ? 'Active' : 'Archived'}
    </span>
  );
}

export default function FeeConfigPage() {
  const toast = useToast();
  const [tab, setTab] = useState('grade');
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusId, setCampusId] = useState('');
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [yearId, setYearId] = useState('');

  // Load campuses (across all schools) once.
  useEffect(() => {
    void (async () => {
      try {
        const schools = await schoolsApi.list();
        const lists = await Promise.all(schools.map((s) => campusesApi.list(s.id).catch(() => [])));
        const flat = lists.flat();
        setCampuses(flat);
        if (flat[0]) setCampusId(flat[0].id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load campuses');
      }
    })();
  }, [toast]);

  // When campus changes, load its academic years + grades.
  useEffect(() => {
    if (!campusId) return;
    void Promise.all([academicYearsApi.list(campusId), gradesApi.list(campusId)])
      .then(([y, g]) => {
        setYears(y);
        setGrades(g);
        setYearId((cur) => cur || y.find((x) => x.isCurrent)?.id || y[0]?.id || '');
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load structure'));
  }, [campusId, toast]);

  const gradeName = useMemo(() => {
    const m = new Map(grades.map((g) => [g.id, g.nameEn]));
    return (id: string) => m.get(id) ?? id.slice(0, 8);
  }, [grades]);

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title="Fee configuration"
          description="Grade fees, transport fares, discount rules and the billing policy that drive enrollment quotes. No values are hardcoded."
        />

        {/* Campus + academic-year context for the fee/transport tabs */}
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Campus" className="min-w-[12rem]">
            <Select value={campusId} onChange={(e) => setCampusId(e.target.value)}>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameEn}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Academic year" className="min-w-[12rem]">
            <Select value={yearId} onChange={(e) => setYearId(e.target.value)}>
              <option value="">—</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="grade">Grade fees</TabsTrigger>
            <TabsTrigger value="transport">Transport fares</TabsTrigger>
            <TabsTrigger value="discounts">Discount rules</TabsTrigger>
            <TabsTrigger value="policy">Policy</TabsTrigger>
          </TabsList>

          <TabsContent value="grade">
            <GradeFees yearId={yearId} grades={grades} gradeName={gradeName} />
          </TabsContent>
          <TabsContent value="transport">
            <TransportFares yearId={yearId} />
          </TabsContent>
          <TabsContent value="discounts">
            <DiscountRules />
          </TabsContent>
          <TabsContent value="policy">
            <PolicyForm />
          </TabsContent>
        </Tabs>
      </div>
    </Shell>
  );
}

function GradeFees({
  yearId,
  grades,
  gradeName,
}: {
  yearId: string;
  grades: Grade[];
  gradeName: (id: string) => string;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<GradeFeeSchedule[]>([]);
  const EMPTY = { gradeId: '', registrationFee: '', tuitionFee: '', effectiveFrom: '' };
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!yearId) return setRows([]);
    feeConfigApi
      .gradeFees(yearId)
      .then(setRows)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Load failed'));
  }, [yearId, toast]);
  useEffect(load, [load]);

  function startEdit(r: GradeFeeSchedule) {
    setEditingId(r.id);
    setForm({
      gradeId: r.gradeId,
      registrationFee: String(Number(r.registrationFee)),
      tuitionFee: String(Number(r.tuitionFee)),
      effectiveFrom: r.effectiveFrom.slice(0, 10),
    });
  }
  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!yearId || !form.gradeId) return;
    setBusy(true);
    try {
      const payload = {
        gradeId: form.gradeId,
        registrationFee: Number(form.registrationFee) || 0,
        tuitionFee: Number(form.tuitionFee) || 0,
        effectiveFrom: form.effectiveFrom || new Date().toISOString().slice(0, 10),
      };
      if (editingId) {
        await feeConfigApi.updateGradeFee(editingId, payload);
      } else {
        await feeConfigApi.createGradeFee({ ...payload, academicYearId: yearId });
      }
      cancelEdit();
      toast.success('Saved');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(r: GradeFeeSchedule) {
    if (
      r.isActive &&
      !(await confirm({
        description: `Archive the grade fee for ${gradeName(r.gradeId)}? It will no longer be used for new quotes but is kept for the record.`,
        confirmLabel: 'Archive',
        destructive: false,
      }))
    ) {
      return;
    }
    try {
      await feeConfigApi.updateGradeFee(r.id, { isActive: !r.isActive });
      if (editingId === r.id) cancelEdit();
      toast.success(r.isActive ? 'Archived' : 'Restored');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grade fees</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={(e) => void submit(e)} className="grid gap-2 sm:grid-cols-5">
          <Field label="Grade">
            <Select
              value={form.gradeId}
              onChange={(e) => setForm({ ...form, gradeId: e.target.value })}
              required
            >
              <option value="">—</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nameEn}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Registration">
            <Input
              type="number"
              step="0.001"
              value={form.registrationFee}
              onChange={(e) => setForm({ ...form, registrationFee: e.target.value })}
              dir="ltr"
            />
          </Field>
          <Field label="Tuition">
            <Input
              type="number"
              step="0.001"
              value={form.tuitionFee}
              onChange={(e) => setForm({ ...form, tuitionFee: e.target.value })}
              dir="ltr"
            />
          </Field>
          <Field label="Effective from">
            <Input
              type="date"
              value={form.effectiveFrom}
              onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
              dir="ltr"
            />
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={!yearId || !form.gradeId || busy}>
              {busy ? '…' : editingId ? 'Save' : 'Add'}
            </Button>
            {editingId ? (
              <Button type="button" variant="outline" onClick={cancelEdit} disabled={busy}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>

        <Table>
          <THead>
            <TR>
              <TH>Grade</TH>
              <TH className="text-end">Registration</TH>
              <TH className="text-end">Tuition</TH>
              <TH>Effective from</TH>
              <TH>Status</TH>
              <TH className="text-end">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id} className={r.isActive ? undefined : 'opacity-60'}>
                <TD>{gradeName(r.gradeId)}</TD>
                <TD className="text-end font-mono">{jod(r.registrationFee)}</TD>
                <TD className="text-end font-mono">{jod(r.tuitionFee)}</TD>
                <TD className="font-mono text-xs">{r.effectiveFrom.slice(0, 10)}</TD>
                <TD>
                  <StatusBadge active={r.isActive} />
                </TD>
                <TD className="text-end">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(r)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void toggleActive(r)}>
                      {r.isActive ? 'Archive' : 'Restore'}
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
            {rows.length === 0 ? (
              <TR>
                <TD colSpan={6}>
                  <EmptyState title={yearId ? 'No grade fees yet' : 'Select an academic year'} />
                </TD>
              </TR>
            ) : null}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TransportFares({ yearId }: { yearId: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<TransportFare[]>([]);
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const EMPTY = { routeName: '', amount: '', oneWayPct: '' };
  const [form, setForm] = useState(EMPTY);
  const [addingRoute, setAddingRoute] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const NEW_ROUTE = '__new__';

  const load = useCallback(() => {
    if (!yearId) return setRows([]);
    feeConfigApi
      .transportFares(yearId)
      .then(setRows)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Load failed'));
  }, [yearId, toast]);
  useEffect(load, [load]);

  // Routes for the selected year, shared with the Fleet tab (same BusRoute entity).
  const loadRoutes = useCallback(() => {
    if (!yearId) return setRoutes([]);
    busApi
      .listRoutes(yearId)
      .then(setRoutes)
      .catch(() => setRoutes([]));
  }, [yearId]);
  useEffect(loadRoutes, [loadRoutes]);

  function startEdit(r: TransportFare) {
    setEditingId(r.id);
    setAddingRoute(false);
    setForm({
      routeName: r.route?.name ?? '',
      amount: String(Number(r.amount)),
      oneWayPct: String(Number(r.oneWayPct)),
    });
  }
  function cancelEdit() {
    setEditingId(null);
    setAddingRoute(false);
    setForm(EMPTY);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!yearId) return;
    setBusy(true);
    try {
      // Send the route name; the API reuses the matching fleet route or creates it atomically.
      const routeName = form.routeName.trim();
      if (editingId) {
        await feeConfigApi.updateTransportFare(editingId, {
          ...(routeName ? { routeName } : { routeId: null }),
          amount: Number(form.amount) || 0,
          oneWayPct: Number(form.oneWayPct) || 0,
        });
      } else {
        await feeConfigApi.createTransportFare({
          academicYearId: yearId,
          ...(routeName ? { routeName } : {}),
          amount: Number(form.amount) || 0,
          oneWayPct: Number(form.oneWayPct) || 0,
        });
      }
      cancelEdit();
      loadRoutes(); // a new route may have just been created
      toast.success('Saved');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function deleteFare(r: TransportFare) {
    if (
      !(await confirm({
        description: `Delete the ${r.route?.name || '—'} fare? This removes the fare only — the route stays in Fleet & transport.`,
        confirmLabel: 'Delete',
        destructive: true,
      }))
    ) {
      return;
    }
    try {
      await feeConfigApi.deleteTransportFare(r.id);
      if (editingId === r.id) cancelEdit();
      toast.success('Deleted');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transport fares</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Routes are shared with the Transport/Fleet tab. Pick an existing route or type a new one —
          a new route is also created in the fleet. Set the two-way (round trip) total and the
          one-way price as a percentage of it; the direction is chosen per student at admission.
        </p>
        <form onSubmit={(e) => void submit(e)} className="grid gap-2 sm:grid-cols-4">
          <Field label="Route">
            {addingRoute ? (
              <Input
                value={form.routeName}
                onChange={(e) => setForm({ ...form, routeName: e.target.value })}
                placeholder="New route name, e.g. A,B,C"
                autoFocus
              />
            ) : (
              <Select
                value={form.routeName}
                onChange={(e) => {
                  if (e.target.value === NEW_ROUTE) {
                    setAddingRoute(true);
                    setForm({ ...form, routeName: '' });
                  } else {
                    setForm({ ...form, routeName: e.target.value });
                  }
                }}
              >
                <option value="">No route</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
                <option value={NEW_ROUTE}>＋ New route…</option>
              </Select>
            )}
          </Field>
          <Field label="Two-way total (annual)">
            <Input
              type="number"
              step="0.001"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              dir="ltr"
            />
          </Field>
          <Field label="One-way (% of total) *">
            <Input
              type="number"
              step="0.01"
              min={0}
              max={100}
              value={form.oneWayPct}
              onChange={(e) => setForm({ ...form, oneWayPct: e.target.value })}
              required
              dir="ltr"
            />
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={!yearId || busy}>
              {busy ? '…' : editingId ? 'Save' : 'Add'}
            </Button>
            {editingId ? (
              <Button type="button" variant="outline" onClick={cancelEdit} disabled={busy}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
        <Table>
          <THead>
            <TR>
              <TH>Route</TH>
              <TH className="text-end">Two-way total</TH>
              <TH className="text-end">One-way</TH>
              <TH>Status</TH>
              <TH className="text-end">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => {
              const routeDisabled = Boolean(r.route?.disabledAt);
              return (
                <TR key={r.id} className={routeDisabled ? 'opacity-60' : undefined}>
                  <TD>
                    {r.route?.name ? (
                      <span className="font-medium">{r.route.name}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {r.route?.description ? (
                      <span className="block text-xs text-muted-foreground">
                        {r.route.description}
                      </span>
                    ) : null}
                    {r.route?.round1Time || r.route?.round2Time ? (
                      <span className="block font-mono text-xs text-muted-foreground">
                        {[r.route?.round1Time, r.route?.round2Time].filter(Boolean).join(' · ')}
                      </span>
                    ) : null}
                  </TD>
                  <TD className="text-end font-mono">{jod(r.amount)}</TD>
                  <TD className="text-end font-mono">
                    {jod((Number(r.amount) * Number(r.oneWayPct)) / 100)}
                    <span className="text-muted-foreground"> ({Number(r.oneWayPct)}%)</span>
                  </TD>
                  <TD>
                    {routeDisabled ? (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Disabled
                      </span>
                    ) : (
                      <StatusBadge active />
                    )}
                  </TD>
                  <TD className="text-end">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(r)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void deleteFare(r)}>
                        Delete
                      </Button>
                    </div>
                  </TD>
                </TR>
              );
            })}
            {rows.length === 0 ? (
              <TR>
                <TD colSpan={5}>
                  <EmptyState
                    title={yearId ? 'No transport fares yet' : 'Select an academic year'}
                  />
                </TD>
              </TR>
            ) : null}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DiscountRules() {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<DiscountRule[]>([]);
  const EMPTY = {
    name: '',
    type: 'FULL_PAYMENT' as DiscountRule['type'],
    calc: 'PERCENT' as DiscountRule['calc'],
    value: '',
  };
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    feeConfigApi
      .discountRules()
      .then(setRows)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Load failed'));
  }, [toast]);
  useEffect(load, [load]);

  function startEdit(r: DiscountRule) {
    setEditingId(r.id);
    setForm({ name: r.name, type: r.type, calc: r.calc, value: String(Number(r.value)) });
  }
  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) return;
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        type: form.type,
        calc: form.calc,
        value: Number(form.value) || 0,
      };
      if (editingId) {
        await feeConfigApi.updateDiscountRule(editingId, payload);
      } else {
        await feeConfigApi.createDiscountRule(payload);
      }
      cancelEdit();
      toast.success('Saved');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(r: DiscountRule) {
    if (
      r.isActive &&
      !(await confirm({
        description: `Archive the discount rule "${r.name}"? It can no longer be applied but is kept for the record.`,
        confirmLabel: 'Archive',
        destructive: false,
      }))
    ) {
      return;
    }
    try {
      await feeConfigApi.updateDiscountRule(r.id, { isActive: !r.isActive });
      if (editingId === r.id) cancelEdit();
      toast.success(r.isActive ? 'Archived' : 'Restored');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Discount rules</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={(e) => void submit(e)} className="grid gap-2 sm:grid-cols-5">
          <Field label="Name" className="sm:col-span-2">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <Field label="Type">
            <Select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as DiscountRule['type'] })}
            >
              {['FULL_PAYMENT', 'SIBLING', 'SCHOLARSHIP', 'PROMOTIONAL', 'MANUAL'].map((x) => (
                <option key={x} value={x}>
                  {x.replace('_', ' ')}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Calc">
            <Select
              value={form.calc}
              onChange={(e) => setForm({ ...form, calc: e.target.value as DiscountRule['calc'] })}
            >
              <option value="PERCENT">PERCENT</option>
              <option value="FIXED">FIXED</option>
            </Select>
          </Field>
          <Field label="Value">
            <Input
              type="number"
              step="0.001"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              dir="ltr"
            />
          </Field>
          <div className="flex items-end gap-2 sm:col-span-5">
            <Button type="submit" disabled={!form.name || busy}>
              {busy ? '…' : editingId ? 'Save rule' : 'Add rule'}
            </Button>
            {editingId ? (
              <Button type="button" variant="outline" onClick={cancelEdit} disabled={busy}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Type</TH>
              <TH>Calc</TH>
              <TH className="text-end">Value</TH>
              <TH>Status</TH>
              <TH className="text-end">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id} className={r.isActive ? undefined : 'opacity-60'}>
                <TD>{r.name}</TD>
                <TD>{r.type.replace('_', ' ')}</TD>
                <TD>{r.calc}</TD>
                <TD className="text-end font-mono">
                  {r.calc === 'PERCENT' ? `${Number(r.value)}%` : jod(r.value)}
                </TD>
                <TD>
                  <StatusBadge active={r.isActive} />
                </TD>
                <TD className="text-end">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(r)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void toggleActive(r)}>
                      {r.isActive ? 'Archive' : 'Restore'}
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
            {rows.length === 0 ? (
              <TR>
                <TD colSpan={6}>
                  <EmptyState title="No discount rules yet" />
                </TD>
              </TR>
            ) : null}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PolicyForm() {
  const toast = useToast();
  const [policy, setPolicy] = useState<BillingPolicy | null>(null);
  const [form, setForm] = useState({
    minInstallments: '1',
    maxInstallments: '9',
    fullPaymentDiscountPct: '0',
    suspendTransportAfterOverdue: '2',
    suspendTransportAfterDays: '',
    suspendTransportAfterAmount: '',
    allowSelfFeeApproval: false,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void feeConfigApi
      .policy()
      .then((p) => {
        if (!p) return;
        setPolicy(p);
        setForm({
          minInstallments: String(p.minInstallments),
          maxInstallments: String(p.maxInstallments),
          fullPaymentDiscountPct: String(Number(p.fullPaymentDiscountPct)),
          suspendTransportAfterOverdue: String(p.suspendTransportAfterOverdue),
          suspendTransportAfterDays: p.suspendTransportAfterDays
            ? String(p.suspendTransportAfterDays)
            : '',
          suspendTransportAfterAmount: p.suspendTransportAfterAmount
            ? String(Number(p.suspendTransportAfterAmount))
            : '',
          allowSelfFeeApproval: p.allowSelfFeeApproval,
        });
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Load failed'));
  }, [toast]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await feeConfigApi.upsertPolicy({
        minInstallments: Number(form.minInstallments) || 1,
        maxInstallments: Number(form.maxInstallments) || 9,
        fullPaymentDiscountPct: Number(form.fullPaymentDiscountPct) || 0,
        suspendTransportAfterOverdue: Number(form.suspendTransportAfterOverdue) || 2,
        ...(form.suspendTransportAfterDays
          ? { suspendTransportAfterDays: Number(form.suspendTransportAfterDays) }
          : {}),
        ...(form.suspendTransportAfterAmount
          ? { suspendTransportAfterAmount: Number(form.suspendTransportAfterAmount) }
          : {}),
        allowSelfFeeApproval: form.allowSelfFeeApproval,
      });
      setPolicy(saved);
      toast.success('Policy saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing policy</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void submit(e)} className="grid gap-3 sm:grid-cols-2">
          <Field label="Min installments" hint="Lower bound for installment plans">
            <Input
              type="number"
              value={form.minInstallments}
              onChange={(e) => setForm({ ...form, minInstallments: e.target.value })}
              dir="ltr"
            />
          </Field>
          <Field label="Max installments" hint="Upper bound (spec: 9)">
            <Input
              type="number"
              value={form.maxInstallments}
              onChange={(e) => setForm({ ...form, maxInstallments: e.target.value })}
              dir="ltr"
            />
          </Field>
          <Field label="Full-payment discount (%)">
            <Input
              type="number"
              step="0.01"
              value={form.fullPaymentDiscountPct}
              onChange={(e) => setForm({ ...form, fullPaymentDiscountPct: e.target.value })}
              dir="ltr"
            />
          </Field>
          <Field label="Suspend transport after N overdue">
            <Input
              type="number"
              value={form.suspendTransportAfterOverdue}
              onChange={(e) => setForm({ ...form, suspendTransportAfterOverdue: e.target.value })}
              dir="ltr"
            />
          </Field>
          <Field label="…or after N days overdue" hint="Optional — leave blank to disable">
            <Input
              type="number"
              value={form.suspendTransportAfterDays}
              onChange={(e) => setForm({ ...form, suspendTransportAfterDays: e.target.value })}
              dir="ltr"
            />
          </Field>
          <Field label="…or overdue amount (JOD)" hint="Optional — leave blank to disable">
            <Input
              type="number"
              step="0.001"
              value={form.suspendTransportAfterAmount}
              onChange={(e) => setForm({ ...form, suspendTransportAfterAmount: e.target.value })}
              dir="ltr"
            />
          </Field>
          <div className="sm:col-span-2">
            <Checkbox
              checked={form.allowSelfFeeApproval}
              onChange={(e) => setForm({ ...form, allowSelfFeeApproval: e.target.checked })}
              label="Allow self-approval of fee modifications (same user can register and approve). Leave off to require a different approver."
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : policy ? 'Update policy' : 'Create policy'}
            </Button>
          </div>
        </form>

        {policy ? (
          <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-medium">Current policy</h3>
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Installments</dt>
                <dd className="font-mono">
                  {policy.minInstallments}–{policy.maxInstallments}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Full-payment discount</dt>
                <dd className="font-mono">{Number(policy.fullPaymentDiscountPct)}%</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Suspend transport after</dt>
                <dd className="font-mono">{policy.suspendTransportAfterOverdue} overdue</dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            No billing policy saved yet — create one above.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
