'use client';

import { useMemo, useRef, useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  useToast,
} from '@axa/platform';
import { busApi } from '@/lib/bus';
import { runBulk, type TransportData } from './lib';

interface ParsedRow {
  line: number;
  rawId: string;
  rawRoute: string;
  rawTrip: string;
  studentId: string | null;
  routeId: string | null;
  tripRound: number | undefined;
  error: string | null;
}

const TEMPLATE =
  'Student ID,Route,Trip\n1001,Route A,1st Trip\n1002,Route A,Both Trips\n1003,Route B,2nd Trip\n';

function parseTrip(raw: string): { round: number | undefined; ok: boolean } {
  const v = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (v === '' || v === 'no trip' || v === 'none') return { round: undefined, ok: true };
  if (v === '1st trip' || v === '1' || v === 'first') return { round: 1, ok: true };
  if (v === '2nd trip' || v === '2' || v === 'second') return { round: 2, ok: true };
  if (v === 'both trips' || v === 'both' || v === '3') return { round: 3, ok: true };
  return { round: undefined, ok: false };
}

/**
 * Bulk Import — Download template → upload CSV → validate against loaded students/routes →
 * preview row errors → import via the existing assign endpoint. Built for thousands of rows.
 */
export function BulkImport({ data, canAssign }: { data: TransportData; canAssign: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const studentIndex = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of data.students) {
      if (s.moeStudentNumber) m.set(s.moeStudentNumber.toLowerCase(), s.id);
      if (s.nationalId) m.set(s.nationalId.toLowerCase(), s.id);
      m.set(s.qrCode.toLowerCase(), s.id);
    }
    return m;
  }, [data.students]);

  const routeIndex = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of data.routes) m.set(r.name.trim().toLowerCase(), r.id);
    return m;
  }, [data.routes]);

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transport-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(file: File) {
    setFileName(file.name);
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    // Skip a header row if present.
    const start = lines[0]?.toLowerCase().includes('student id') ? 1 : 0;
    const rows: ParsedRow[] = [];
    for (let i = start; i < lines.length; i += 1) {
      const cols = (lines[i] ?? '').split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      const [rawId = '', rawRoute = '', rawTrip = ''] = cols;
      const studentId = studentIndex.get(rawId.toLowerCase()) ?? null;
      const routeId = routeIndex.get(rawRoute.toLowerCase()) ?? null;
      const trip = parseTrip(rawTrip);
      let error: string | null = null;
      if (!rawId) error = t('transport.import.errMissingId');
      else if (!studentId) error = t('transport.import.errUnknownStudent');
      else if (!rawRoute) error = t('transport.import.errMissingRoute');
      else if (!routeId) error = t('transport.import.errUnknownRoute');
      else if (!trip.ok) error = t('transport.import.errBadTrip');
      rows.push({
        line: i + 1,
        rawId,
        rawRoute,
        rawTrip,
        studentId,
        routeId,
        tripRound: trip.round,
        error,
      });
    }
    setParsed(rows);
  }

  const valid = parsed?.filter((r) => !r.error) ?? [];
  const invalid = parsed?.filter((r) => r.error) ?? [];

  async function runImport() {
    if (valid.length === 0) return;
    setImporting(true);
    try {
      const { ok, failed } = await runBulk(valid, async (row) => {
        const a = await busApi.assign({
          studentId: row.studentId as string,
          routeId: row.routeId as string,
          ...(row.tripRound ? { tripRound: row.tripRound } : {}),
        });
        data.mergeAssignment(a);
      });
      if (failed === 0) toast.success(`${t('transport.import.imported')}: ${ok}`);
      else toast.error(`${t('transport.import.imported')}: ${ok} ✓ · ${failed} ✕`);
      setParsed(null);
      setFileName(null);
      if (fileRef.current) fileRef.current.value = '';
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('transport.import.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('transport.import.intro')}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={downloadTemplate}>
              {t('transport.import.downloadTemplate')}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
            <Button size="sm" onClick={() => fileRef.current?.click()}>
              {t('transport.import.upload')}
            </Button>
            {fileName ? (
              <span className="self-center text-xs text-muted-foreground">{fileName}</span>
            ) : null}
          </div>
          <p className="font-mono text-xs text-muted-foreground">Student ID | Route | Trip</p>
        </CardContent>
      </Card>

      {parsed ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>{t('transport.import.preview')}</CardTitle>
              <div className="flex gap-2">
                <Badge tone="success">
                  {valid.length} {t('transport.import.valid')}
                </Badge>
                {invalid.length > 0 ? (
                  <Badge tone="danger">
                    {invalid.length} {t('transport.import.invalid')}
                  </Badge>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-96 overflow-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>#</TH>
                    <TH>{t('transport.table.studentId')}</TH>
                    <TH>{t('fleet.route')}</TH>
                    <TH>{t('fleet.trip')}</TH>
                    <TH>{t('transport.import.statusCol')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {parsed.slice(0, 200).map((r) => (
                    <TR key={r.line} className={r.error ? 'bg-destructive/5' : undefined}>
                      <TD className="text-xs text-muted-foreground">{r.line}</TD>
                      <TD className="font-mono text-xs">{r.rawId}</TD>
                      <TD className="text-sm">{r.rawRoute}</TD>
                      <TD className="text-sm">{r.rawTrip || '—'}</TD>
                      <TD className="text-xs">
                        {r.error ? (
                          <span className="text-destructive">{r.error}</span>
                        ) : (
                          <span className="text-accent-cool">{t('transport.import.ok')}</span>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              {parsed.length > 200 ? (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  {t('transport.import.previewTruncated')}
                </p>
              ) : null}
            </div>
            {canAssign ? (
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setParsed(null);
                    setFileName(null);
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                  disabled={importing}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => void runImport()}
                  disabled={importing || valid.length === 0}
                >
                  {t('transport.import.import')} ({valid.length})
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
