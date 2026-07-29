'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import { usePrincipal } from '@/components/shell';
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
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  useToast,
} from '@axa/platform';
import { useConfirm } from '@/components/confirm';
import {
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  assetsApi,
  employeesApi,
  type Asset,
  type AssetCategory,
  type AssetStatus,
  type Employee,
} from '@/lib/people';

const STATUS_TONE: Record<AssetStatus, 'default' | 'success' | 'warning' | 'danger' | 'muted'> = {
  AVAILABLE: 'success',
  ASSIGNED: 'default',
  IN_REPAIR: 'warning',
  RETIRED: 'muted',
  LOST: 'danger',
};

export default function AssetsPage() {
  const { t } = useI18n();
  const principal = usePrincipal();
  const canManage = principal.permissions.includes('asset:manage') || principal.isPlatform;
  const toast = useToast();
  const confirm = useConfirm();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<AssetStatus | ''>('');
  const EMPTY = { assetTag: '', name: '', category: 'LAPTOP' as AssetCategory };
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [assignEmp, setAssignEmp] = useState('');

  const load = useCallback(async () => {
    try {
      const [as, emps] = await Promise.all([
        assetsApi.list(statusFilter ? { status: statusFilter } : undefined),
        employeesApi.list().catch(() => [] as Employee[]),
      ]);
      setAssets(as);
      setEmployees(emps);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!form.assetTag.trim() || !form.name.trim()) return;
    setBusy(true);
    try {
      await assetsApi.create({
        assetTag: form.assetTag.trim(),
        name: form.name.trim(),
        category: form.category,
      });
      toast.success(t('common.saved'));
      setForm(EMPTY);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function assign(assetId: string) {
    if (!assignEmp) return;
    try {
      await assetsApi.assign(assetId, { employeeId: assignEmp });
      setAssignFor(null);
      setAssignEmp('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function returnAsset(assetId: string) {
    try {
      await assetsApi.return(assetId, {});
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function remove(a: Asset) {
    if (!(await confirm())) return;
    try {
      await assetsApi.remove(a.id);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
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
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold">{t('hr.assetRegister')}</h1>
          <Link
            href="/people/employees"
            className="text-sm text-muted-foreground hover:text-primary-strong"
          >
            ← {t('nav.hr')}
          </Link>
        </div>

        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('hr.addAsset')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-2">
                <Field label={t('hr.assetTag')}>
                  <Input
                    value={form.assetTag}
                    onChange={(e) => setForm({ ...form, assetTag: e.target.value })}
                    placeholder="LAP-001"
                  />
                </Field>
                <Field label={t('common.name')} className="flex-1 min-w-40">
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </Field>
                <Field label={t('hr.assetCategory')}>
                  <Select
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value as AssetCategory })
                    }
                  >
                    {ASSET_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {t(`hr.assetCat.${c}`)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button
                  size="sm"
                  onClick={() => void create()}
                  disabled={busy || !form.assetTag.trim() || !form.name.trim()}
                >
                  {t('common.add')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              {t('hr.assets')}
              <Select
                className="w-40"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as AssetStatus | '')}
              >
                <option value="">{t('hr.allStatuses')}</option>
                {ASSET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`hr.assetStatus.${s}`)}
                  </option>
                ))}
              </Select>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assets.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('hr.noAssetsRegistered')}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>{t('hr.assetTag')}</TH>
                      <TH>{t('common.name')}</TH>
                      <TH>{t('hr.assetCategory')}</TH>
                      <TH>{t('common.status')}</TH>
                      <TH>{t('hr.assignee')}</TH>
                      {canManage ? <TH>{t('common.actions')}</TH> : null}
                    </TR>
                  </THead>
                  <TBody>
                    {assets.map((a) => (
                      <TR key={a.id}>
                        <TD className="font-mono text-xs">{a.assetTag}</TD>
                        <TD>{a.name}</TD>
                        <TD className="text-xs text-muted-foreground">
                          {t(`hr.assetCat.${a.category}`)}
                        </TD>
                        <TD>
                          <Badge tone={STATUS_TONE[a.status]}>
                            {t(`hr.assetStatus.${a.status}`)}
                          </Badge>
                        </TD>
                        <TD className="text-sm">
                          {a.currentAssignee
                            ? `${a.currentAssignee.firstNameEn} ${a.currentAssignee.lastNameEn}`
                            : '—'}
                        </TD>
                        {canManage ? (
                          <TD>
                            {assignFor === a.id ? (
                              <div className="flex items-center gap-1">
                                <Select
                                  className="w-40"
                                  value={assignEmp}
                                  onChange={(e) => setAssignEmp(e.target.value)}
                                >
                                  <option value="">—</option>
                                  {employees.map((emp) => (
                                    <option key={emp.id} value={emp.id}>
                                      {emp.firstNameEn} {emp.lastNameEn}
                                    </option>
                                  ))}
                                </Select>
                                <Button
                                  size="sm"
                                  onClick={() => void assign(a.id)}
                                  disabled={!assignEmp}
                                >
                                  {t('common.save')}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setAssignFor(null);
                                    setAssignEmp('');
                                  }}
                                >
                                  {t('common.cancel')}
                                </Button>
                              </div>
                            ) : (
                              <div className="flex gap-1">
                                {a.status === 'AVAILABLE' ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setAssignFor(a.id)}
                                  >
                                    {t('hr.assign')}
                                  </Button>
                                ) : null}
                                {a.status === 'ASSIGNED' ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => void returnAsset(a.id)}
                                  >
                                    {t('hr.return')}
                                  </Button>
                                ) : null}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={() => void remove(a)}
                                >
                                  {t('common.delete')}
                                </Button>
                              </div>
                            )}
                          </TD>
                        ) : null}
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}
