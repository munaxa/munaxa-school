'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Shell } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import {
  INVENTORY_TXN_TYPES,
  inventoryApi,
  type CreateItemInput,
  type InventoryItem,
  type InventoryTransaction,
  type InventoryTxnType,
  type RecordTxnInput,
} from '@/lib/advanced';
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
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  EmptyState,
} from '@axa/platform';

export default function InventoryPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [txns, setTxns] = useState<InventoryTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [i, tx] = await Promise.all([inventoryApi.items(), inventoryApi.transactions()]);
      setItems(i);
      setTxns(tx);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of items) map.set(i.id, i.name);
    return map;
  }, [items]);

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
        <h1 className="font-display text-2xl font-semibold">{t('nav.inventory')}</h1>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('inventory.addItem')}</CardTitle>
            </CardHeader>
            <CardContent>
              <CreateItem onDone={load} onError={setError} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('inventory.recordMovement')}</CardTitle>
            </CardHeader>
            <CardContent>
              <RecordTxn items={items} onDone={load} onError={setError} />
            </CardContent>
          </Card>
        </div>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-medium">{t('inventory.items')}</h2>
          <Table>
            <THead>
              <TR>
                <TH>{t('inventory.name')}</TH>
                <TH>{t('inventory.sku')}</TH>
                <TH>{t('inventory.category')}</TH>
                <TH>{t('inventory.location')}</TH>
                <TH className="text-end">{t('inventory.onHand')}</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((i) => {
                const low = i.reorderLevel != null && i.quantity <= i.reorderLevel;
                return (
                  <TR key={i.id}>
                    <TD>{i.name}</TD>
                    <TD className="font-mono text-xs text-muted-foreground">{i.sku || '—'}</TD>
                    <TD>{i.category || '—'}</TD>
                    <TD>{i.location || '—'}</TD>
                    <TD className="text-end">
                      <span className="font-mono text-xs">
                        {i.quantity}
                        {i.unit ? ` ${i.unit}` : ''}
                      </span>{' '}
                      {low ? <Badge tone="warning">{t('inventory.low')}</Badge> : null}
                    </TD>
                  </TR>
                );
              })}
              {items.length === 0 ? (
                <TR>
                  <TD colSpan={5}>
                    <EmptyState title={t('inventory.noItems')} />
                  </TD>
                </TR>
              ) : null}
            </TBody>
          </Table>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-medium">{t('inventory.recentMovements')}</h2>
          <Table>
            <THead>
              <TR>
                <TH>{t('inventory.item')}</TH>
                <TH>{t('inventory.type')}</TH>
                <TH>{t('inventory.reason')}</TH>
                <TH>{t('inventory.date')}</TH>
                <TH className="text-end">{t('inventory.qty')}</TH>
              </TR>
            </THead>
            <TBody>
              {txns.map((tx) => (
                <TR key={tx.id}>
                  <TD>{nameById.get(tx.itemId) ?? '—'}</TD>
                  <TD>
                    <Badge
                      tone={tx.type === 'IN' ? 'success' : tx.type === 'OUT' ? 'danger' : 'muted'}
                    >
                      {tx.type}
                    </Badge>
                  </TD>
                  <TD>{tx.reason || '—'}</TD>
                  <TD className="font-mono text-xs">{tx.createdAt.slice(0, 10)}</TD>
                  <TD className="text-end font-mono text-xs">{tx.quantity}</TD>
                </TR>
              ))}
              {txns.length === 0 ? (
                <TR>
                  <TD colSpan={5}>
                    <EmptyState title={t('inventory.noMovements')} />
                  </TD>
                </TR>
              ) : null}
            </TBody>
          </Table>
        </section>
      </div>
    </Shell>
  );
}

function CreateItem({
  onDone,
  onError,
}: {
  onDone: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    name: '',
    sku: '',
    category: '',
    unit: '',
    quantity: '0',
    reorderLevel: '',
    location: '',
  });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: CreateItemInput = { name: form.name, quantity: Number(form.quantity) || 0 };
      if (form.sku) payload.sku = form.sku;
      if (form.category) payload.category = form.category;
      if (form.unit) payload.unit = form.unit;
      if (form.reorderLevel) payload.reorderLevel = Number(form.reorderLevel);
      if (form.location) payload.location = form.location;
      await inventoryApi.createItem(payload);
      setForm({
        name: '',
        sku: '',
        category: '',
        unit: '',
        quantity: '0',
        reorderLevel: '',
        location: '',
      });
      await onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-2 sm:grid-cols-2">
      <Field className="sm:col-span-2" label={t('inventory.itemName')} htmlFor="inv-item-name">
        <Input
          id="inv-item-name"
          placeholder={t('inventory.itemName')}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </Field>
      <Field label={t('inventory.sku')} htmlFor="inv-item-sku">
        <Input
          id="inv-item-sku"
          placeholder={t('inventory.sku')}
          value={form.sku}
          onChange={(e) => setForm({ ...form, sku: e.target.value })}
        />
      </Field>
      <Field label={t('inventory.category')} htmlFor="inv-item-category">
        <Input
          id="inv-item-category"
          placeholder={t('inventory.category')}
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
      </Field>
      <Field label={t('inventory.unitPlaceholder')} htmlFor="inv-item-unit">
        <Input
          id="inv-item-unit"
          placeholder={t('inventory.unitPlaceholder')}
          value={form.unit}
          onChange={(e) => setForm({ ...form, unit: e.target.value })}
        />
      </Field>
      <Field label={t('inventory.location')} htmlFor="inv-item-location">
        <Input
          id="inv-item-location"
          placeholder={t('inventory.location')}
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />
      </Field>
      <Field label={t('inventory.startingQuantity')} htmlFor="inv-item-quantity">
        <Input
          id="inv-item-quantity"
          type="number"
          min={0}
          placeholder={t('inventory.startingQuantity')}
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
        />
      </Field>
      <Field label={t('inventory.reorderLevel')} htmlFor="inv-item-reorder">
        <Input
          id="inv-item-reorder"
          type="number"
          min={0}
          placeholder={t('inventory.reorderLevel')}
          value={form.reorderLevel}
          onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
        />
      </Field>
      <Button type="submit" className="sm:col-span-2" disabled={busy}>
        {busy ? t('common.saving') : t('inventory.addItemBtn')}
      </Button>
    </form>
  );
}

function RecordTxn({
  items,
  onDone,
  onError,
}: {
  items: InventoryItem[];
  onDone: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const { t } = useI18n();
  const [itemId, setItemId] = useState('');
  const [type, setType] = useState<InventoryTxnType>('IN');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: RecordTxnInput = { itemId, type, quantity: Number(quantity) || 0 };
      if (reason) payload.reason = reason;
      await inventoryApi.recordTransaction(payload);
      setItemId('');
      setQuantity('1');
      setReason('');
      await onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Record failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-2 sm:grid-cols-2">
      <Select
        className="sm:col-span-2"
        value={itemId}
        onChange={(e) => setItemId(e.target.value)}
        required
      >
        <option value="" disabled>
          {t('inventory.selectItem')}
        </option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name} ({i.quantity}
            {i.unit ? ` ${i.unit}` : ''})
          </option>
        ))}
      </Select>
      <Select value={type} onChange={(e) => setType(e.target.value as InventoryTxnType)}>
        {INVENTORY_TXN_TYPES.map((tp) => (
          <option key={tp} value={tp}>
            {tp}
          </option>
        ))}
      </Select>
      <Input
        type="number"
        min={0}
        placeholder={t('inventory.quantity')}
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        required
      />
      <Input
        className="sm:col-span-2"
        placeholder={t('inventory.reason')}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <Button type="submit" className="sm:col-span-2" disabled={busy}>
        {busy ? t('common.recording') : t('inventory.recordMovementBtn')}
      </Button>
    </form>
  );
}
