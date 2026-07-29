'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  EmptyState,
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
import { admissionsApi, type FeeItem, type FeeItemKind, type GradeFeeItem } from '@/lib/admissions';
import { schoolsApi, campusesApi, gradesApi, academicYearsApi } from '@/lib/structure';
import type { AcademicYear, Campus, Grade } from '@/lib/structure';

const KINDS: FeeItemKind[] = [
  'REGISTRATION',
  'TUITION',
  'BOOKS',
  'UNIFORM',
  'INSURANCE',
  'ACTIVITY',
  'TECHNOLOGY',
  'EXAM',
  'LABORATORY',
  'TRANSPORT',
  'CUSTOM',
];

/**
 * Fee catalog admin: define the fee items a school charges (mandatory/optional, discountable) and
 * set per-grade, per-academic-year amounts. Amounts are effective-dated (set = supersede). The
 * admissions quote engine reads these. Requires finance:manage.
 */
export default function FeeCatalogPage() {
  const toast = useToast();
  const [items, setItems] = useState<FeeItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New item form
  const [kind, setKind] = useState<FeeItemKind>('CUSTOM');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [mandatory, setMandatory] = useState(false);
  const [discountable, setDiscountable] = useState(false);
  const [busy, setBusy] = useState(false);

  // Grade/year amounts
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusId, setCampusId] = useState('');
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [academicYearId, setAcademicYearId] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [gradeFees, setGradeFees] = useState<GradeFeeItem[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await admissionsApi.listFeeItems());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load fee items');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    void (async () => {
      try {
        const schools = await schoolsApi.list();
        const lists = await Promise.all(schools.map((s) => campusesApi.list(s.id).catch(() => [])));
        const flat = lists.flat();
        setCampuses(flat);
        if (flat[0]) setCampusId(flat[0].id);
      } catch {
        /* non-fatal */
      }
    })();
  }, []);

  useEffect(() => {
    if (!campusId) return;
    void Promise.all([academicYearsApi.list(campusId), gradesApi.list(campusId)])
      .then(([y, g]) => {
        setYears(y);
        setGrades(g);
        setAcademicYearId((cur) => cur || y.find((x) => x.isCurrent)?.id || y[0]?.id || '');
      })
      .catch(() => undefined);
  }, [campusId]);

  const loadGradeFees = useCallback(async () => {
    if (!academicYearId || !gradeId) return;
    try {
      const rows = await admissionsApi.listGradeFeeItems(academicYearId, gradeId);
      const active = rows.filter((r) => r.isActive);
      setGradeFees(active);
      setAmounts(Object.fromEntries(active.map((r) => [r.feeItemId, Number(r.amount).toFixed(3)])));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load amounts');
    }
  }, [academicYearId, gradeId, toast]);

  useEffect(() => {
    void loadGradeFees();
  }, [loadGradeFees]);

  async function createItem() {
    if (!nameEn.trim() || !nameAr.trim()) {
      toast.error('Name (EN & AR) are required.');
      return;
    }
    setBusy(true);
    try {
      await admissionsApi.createFeeItem({ kind, nameEn, nameAr, mandatory, discountable });
      setNameEn('');
      setNameAr('');
      setMandatory(false);
      setDiscountable(false);
      toast.success('Fee item created');
      await loadItems();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(item: FeeItem) {
    try {
      await admissionsApi.updateFeeItem(item.id, { isActive: !item.isActive });
      await loadItems();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    }
  }

  async function saveAmount(item: FeeItem) {
    const value = Number(amounts[item.id]);
    if (!academicYearId || !gradeId || Number.isNaN(value)) {
      toast.error('Pick a year + grade and enter a valid amount.');
      return;
    }
    try {
      await admissionsApi.upsertGradeFeeItem({
        feeItemId: item.id,
        gradeId,
        academicYearId,
        amount: value,
        mandatory: item.mandatory,
        discountable: item.discountable,
      });
      toast.success(`${item.nameEn} amount set`);
      await loadGradeFees();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save amount');
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-semibold">Fee catalog</h1>
        <p className="text-sm text-muted-foreground">
          Define fee items and set per-grade, per-year amounts used by admissions quotations.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Add fee item</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="Kind">
            <Select value={kind} onChange={(e) => setKind(e.target.value as FeeItemKind)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </Select>
          </Field>
          <div />
          <Field label="Name (EN)">
            <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </Field>
          <Field label="Name (AR)">
            <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} />{' '}
            Mandatory
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={discountable} onChange={(e) => setDiscountable(e.target.checked)} />{' '}
            Discountable
          </label>
          <div className="sm:col-span-2">
            <Button onClick={() => void createItem()} disabled={busy}>
              {busy ? 'Adding…' : 'Add fee item'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-grade amounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Campus">
              <Select value={campusId} onChange={(e) => setCampusId(e.target.value)}>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameEn}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Academic year">
              <Select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}>
                <option value="">—</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Grade">
              <Select value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
                <option value="">—</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nameEn}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <EmptyState title="No fee items yet" description="Add a fee item above to begin." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Fee item</TH>
                  <TH>Flags</TH>
                  <TH className="text-end">Amount (JOD)</TH>
                  <TH />
                  <TH />
                </TR>
              </THead>
              <TBody>
                {items.map((item) => {
                  const hasAmount = gradeFees.some((g) => g.feeItemId === item.id);
                  return (
                    <TR key={item.id}>
                      <TD>
                        <span className={item.isActive ? '' : 'text-muted-foreground line-through'}>
                          {item.nameEn}
                        </span>
                        <span className="ms-2 font-mono text-[10px] uppercase text-muted-foreground">
                          {item.kind}
                        </span>
                      </TD>
                      <TD className="space-x-1">
                        {item.mandatory ? <Badge tone="default">mandatory</Badge> : null}
                        {item.discountable ? <Badge tone="success">discountable</Badge> : null}
                      </TD>
                      <TD className="text-end">
                        <Input
                          type="number"
                          min={0}
                          step="0.001"
                          dir="ltr"
                          className="w-32"
                          value={amounts[item.id] ?? ''}
                          onChange={(e) => setAmounts((p) => ({ ...p, [item.id]: e.target.value }))}
                          placeholder={hasAmount ? '' : 'not set'}
                          disabled={!academicYearId || !gradeId}
                        />
                      </TD>
                      <TD>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void saveAmount(item)}
                          disabled={!academicYearId || !gradeId}
                        >
                          Set
                        </Button>
                      </TD>
                      <TD>
                        <Button size="sm" variant="ghost" onClick={() => void toggleActive(item)}>
                          {item.isActive ? 'Disable' : 'Enable'}
                        </Button>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
