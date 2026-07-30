'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import { financeApi, type FinanceDimensionRow } from '@/lib/finance';
import { familiesApi } from '@/lib/families';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  PageHeader,
  Select,
  Spinner,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from '@axa/platform';

type Dimension = 'category' | 'academicYear' | 'grade' | 'campus';
const DIMENSIONS: { value: Dimension; label: string }[] = [
  { value: 'category', label: 'Fee category' },
  { value: 'academicYear', label: 'Academic year' },
  { value: 'grade', label: 'Grade' },
  { value: 'campus', label: 'Campus' },
];

const num = (v: string | number) => Number(v).toFixed(3);

interface OutstandingRow {
  dimId: string | null;
  label: string;
  net: string;
  paid: string;
  outstanding: string;
  chargeCount: number;
}

/** Finance reporting: account-first outstanding (family / student drill-down) + revenue by dimension. */
export default function FinanceReportsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [dimension, setDimension] = useState<Dimension>('category');
  const [rows, setRows] = useState<FinanceDimensionRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Account-first outstanding — the finance-first default, with a student drill-down.
  const [groupBy, setGroupBy] = useState<'family' | 'student'>('family');
  const [outRows, setOutRows] = useState<OutstandingRow[]>([]);
  const [outLoading, setOutLoading] = useState(true);

  const load = useCallback(async (dim: Dimension) => {
    setLoading(true);
    try {
      setRows(await financeApi.reportSummary(dim));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOutstanding = useCallback(async (by: 'family' | 'student') => {
    setOutLoading(true);
    try {
      setOutRows(await familiesApi.outstandingReport(by));
    } finally {
      setOutLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(dimension);
  }, [dimension, load]);

  useEffect(() => {
    void loadOutstanding(groupBy);
  }, [groupBy, loadOutstanding]);

  const totals = rows.reduce(
    (acc, r) => ({
      gross: acc.gross + Number(r.gross),
      discount: acc.discount + Number(r.discount),
      net: acc.net + Number(r.net),
      paid: acc.paid + Number(r.paid),
      outstanding: acc.outstanding + Number(r.outstanding),
    }),
    { gross: 0, discount: 0, net: 0, paid: 0, outstanding: 0 },
  );

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title={<>{t('nav.finance')} · Reports</>} />

        {/* Account-first outstanding — finance is account-centric; students are a drill-down. */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Outstanding by {groupBy === 'family' ? 'account' : 'student'}</CardTitle>
            <Field label="" className="w-48">
              <Select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as 'family' | 'student')}
              >
                <option value="family">By account</option>
                <option value="student">By student</option>
              </Select>
            </Field>
          </CardHeader>
          <CardContent>
            {outLoading ? (
              <Spinner />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>{groupBy === 'family' ? 'Account' : 'Student'}</TH>
                    <TH>Net</TH>
                    <TH>Collected</TH>
                    <TH>Outstanding</TH>
                  </TR>
                </THead>
                <TBody>
                  {outRows.map((r) => (
                    <TR
                      key={r.dimId ?? 'unassigned'}
                      className={groupBy === 'family' && r.dimId ? 'cursor-pointer' : ''}
                      onClick={() =>
                        groupBy === 'family' &&
                        r.dimId &&
                        router.push(`/finance?account=${r.dimId}`)
                      }
                    >
                      <TD>{r.label}</TD>
                      <TD>{num(r.net)}</TD>
                      <TD>{num(r.paid)}</TD>
                      <TD>{num(r.outstanding)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex items-end gap-2">
          <Field label="Group by" className="w-64">
            <Select value={dimension} onChange={(e) => setDimension(e.target.value as Dimension)}>
              {DIMENSIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Revenue &amp; outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Spinner />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Group</TH>
                    <TH>Charges</TH>
                    <TH>Gross</TH>
                    <TH>Discount</TH>
                    <TH>Net</TH>
                    <TH>Collected</TH>
                    <TH>Outstanding</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((r) => (
                    <TR key={r.dimId ?? 'none'}>
                      <TD>{r.label}</TD>
                      <TD>{r.chargeCount}</TD>
                      <TD>{num(r.gross)}</TD>
                      <TD>{num(r.discount)}</TD>
                      <TD>{num(r.net)}</TD>
                      <TD>{num(r.paid)}</TD>
                      <TD>{num(r.outstanding)}</TD>
                    </TR>
                  ))}
                  <TR>
                    <TD>
                      <strong>Total</strong>
                    </TD>
                    <TD> </TD>
                    <TD>
                      <strong>{num(totals.gross)}</strong>
                    </TD>
                    <TD>
                      <strong>{num(totals.discount)}</strong>
                    </TD>
                    <TD>
                      <strong>{num(totals.net)}</strong>
                    </TD>
                    <TD>
                      <strong>{num(totals.paid)}</strong>
                    </TD>
                    <TD>
                      <strong>{num(totals.outstanding)}</strong>
                    </TD>
                  </TR>
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}
