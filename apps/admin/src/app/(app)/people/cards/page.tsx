'use client';

import { useCallback, useState } from 'react';
import { Shell } from '@/components/shell';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  EntityPicker,
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
import { useI18n } from '@/components/i18n-provider';
import { useConfirm } from '@/components/confirm';
import { loadStudentOptions } from '@/lib/pickers';
import { cardsApi, type CardStatus, type CardType, type StudentCard } from '@/lib/cards';

const STATUS_TONE: Record<CardStatus, 'success' | 'warning' | 'danger' | 'muted'> = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  STOLEN: 'danger',
  LOST: 'danger',
  REVOKED: 'muted',
};
const STATUSES: CardStatus[] = ['ACTIVE', 'SUSPENDED', 'STOLEN', 'LOST', 'REVOKED'];

export default function StudentCardsPage() {
  const toast = useToast();
  const { t } = useI18n();
  const confirm = useConfirm();
  const [studentId, setStudentId] = useState('');
  const [cards, setCards] = useState<StudentCard[]>([]);
  const [form, setForm] = useState<{ cardUid: string; type: CardType; label: string }>({
    cardUid: '',
    type: 'NFC',
    label: '',
  });

  const load = useCallback(
    async (id = studentId) => {
      if (!id) return;
      try {
        setCards(await cardsApi.list(id));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load');
      }
    },
    [studentId, toast],
  );

  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.success(ok);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold">{t('cards.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('cards.subtitle')}</p>
        </div>

        <div className="flex items-end gap-2">
          <Field label={t('finance.student')} className="flex-1">
            <EntityPicker
              value={studentId}
              onChange={(v) => {
                setStudentId(v);
                void load(v);
              }}
              load={loadStudentOptions}
              placeholder={t('finance.searchStudent')}
            />
          </Field>
        </div>

        {studentId ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('nav.cards')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <THead>
                  <TR>
                    <TH>{t('cards.cardUid')}</TH>
                    <TH>{t('common.type')}</TH>
                    <TH>{t('common.label')}</TH>
                    <TH>{t('common.status')}</TH>
                    <TH className="text-end">{t('common.actions')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {cards.map((c) => (
                    <TR key={c.id}>
                      <TD className="font-mono text-xs">{c.cardUid}</TD>
                      <TD>{c.type}</TD>
                      <TD className="text-muted-foreground">{c.label ?? '—'}</TD>
                      <TD>
                        <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                      </TD>
                      <TD className="text-end">
                        <span className="flex items-center justify-end gap-2">
                          <Select
                            value={c.status}
                            onChange={(e) =>
                              void run(
                                () =>
                                  cardsApi.update(c.id, { status: e.target.value as CardStatus }),
                                'Card updated',
                              )
                            }
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </Select>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() =>
                              void confirm().then((ok) => {
                                if (ok) void run(() => cardsApi.remove(c.id), 'Card deleted');
                              })
                            }
                          >
                            {t('common.delete')}
                          </Button>
                        </span>
                      </TD>
                    </TR>
                  ))}
                  {cards.length === 0 ? (
                    <TR>
                      <TD colSpan={5}>
                        <EmptyState title={t('cards.noCards')} />
                      </TD>
                    </TR>
                  ) : null}
                </TBody>
              </Table>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(
                    () =>
                      cardsApi.issue({
                        studentId,
                        cardUid: form.cardUid.trim(),
                        type: form.type,
                        ...(form.label ? { label: form.label } : {}),
                      }),
                    'Card issued',
                  ).then(() => setForm({ cardUid: '', type: 'NFC', label: '' }));
                }}
                className="flex flex-wrap items-end gap-2"
              >
                <Field label={t('cards.cardUid')} className="flex-1">
                  <Input
                    placeholder="04:A2:39:B1:5C:80"
                    value={form.cardUid}
                    onChange={(e) => setForm({ ...form, cardUid: e.target.value })}
                    required
                  />
                </Field>
                <Field label={t('common.type')}>
                  <Select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as CardType })}
                  >
                    <option value="NFC">NFC</option>
                    <option value="RFID">RFID</option>
                  </Select>
                </Field>
                <Field label={t('common.label')}>
                  <Input
                    placeholder={t('cards.labelPlaceholder')}
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                  />
                </Field>
                <Button type="submit">{t('cards.issueCard')}</Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </Shell>
  );
}
