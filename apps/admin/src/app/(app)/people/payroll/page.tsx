'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DatePicker,
  Field,
  PageHeader,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from '@axa/platform';
import { attendanceApi, type PayrollPrepResult } from '@/lib/people';

/** First and last day of the current month, ISO date. */
function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

export default function PayrollPrepPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [range, setRange] = useState(currentMonthRange);
  const [result, setResult] = useState<PayrollPrepResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!range.from || !range.to) return;
    setLoading(true);
    try {
      setResult(await attendanceApi.payrollPrep(range.from, range.to));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  async function download(format: 'csv' | 'xlsx' | 'pdf') {
    try {
      await attendanceApi.downloadPayrollPrep(range.from, range.to, format);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title={t('hr.payrollPrep')}
          align="center"
          actions={
            <Link
              href="/people/employees"
              className="text-sm text-muted-foreground hover:text-primary-strong"
            >
              ← {t('nav.hr')}
            </Link>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>{t('hr.payrollPeriod')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-2">
              <Field label={t('hr.startDate')}>
                <DatePicker
                  value={range.from}
                  onChange={(value) => setRange({ ...range, from: value })}
                />
              </Field>
              <Field label={t('hr.endDate')}>
                <DatePicker
                  value={range.to}
                  onChange={(value) => setRange({ ...range, to: value })}
                />
              </Field>
              <Button size="sm" onClick={() => void run()} disabled={loading}>
                {t('hr.generate')}
              </Button>
              {result ? (
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => void download('csv')}>
                    CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void download('xlsx')}>
                    Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void download('pdf')}>
                    PDF
                  </Button>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {result ? (
          <Card>
            <CardHeader>
              <CardTitle>
                {t('hr.payrollPrep')} · {result.from} → {result.to} · {result.workingDays}{' '}
                {t('hr.workingDays')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('hr.noEmployees')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <THead>
                      <TR>
                        <TH>{t('people.employeeNumber')}</TH>
                        <TH>{t('common.name')}</TH>
                        <TH className="text-end">{t('hr.present')}</TH>
                        <TH className="text-end">{t('hr.absent')}</TH>
                        <TH className="text-end">{t('hr.late')}</TH>
                        <TH className="text-end">{t('hr.overtimeHours')}</TH>
                        <TH className="text-end">{t('hr.paidLeave')}</TH>
                        <TH className="text-end">{t('hr.unpaidLeave')}</TH>
                        <TH className="text-end">{t('hr.payableDays')}</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {result.rows.map((r) => (
                        <TR key={r.employeeId}>
                          <TD className="font-mono text-xs">{r.employeeNumber ?? '—'}</TD>
                          <TD>{r.employeeName}</TD>
                          <TD className="text-end font-mono text-xs">{r.presentDays}</TD>
                          <TD className="text-end font-mono text-xs">{r.absentDays}</TD>
                          <TD className="text-end font-mono text-xs">{r.lateDays}</TD>
                          <TD className="text-end font-mono text-xs">{r.overtimeHours}</TD>
                          <TD className="text-end font-mono text-xs">{r.paidLeaveDays}</TD>
                          <TD className="text-end font-mono text-xs">{r.unpaidLeaveDays}</TD>
                          <TD className="text-end font-mono text-xs font-semibold">
                            {r.payableDays}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </Shell>
  );
}
