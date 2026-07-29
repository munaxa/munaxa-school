'use client';

import { useState } from 'react';
import {
  reportingApi,
  type ReportFilters,
  type ReportFormat,
  type ReportKind,
  type ReportTable,
} from '@/lib/reporting';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EntityPicker,
  Field,
  Input,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from '@axa/platform';
import { Shell } from '@/components/shell';
import { loadSectionOptions } from '@/lib/pickers';
import { useI18n } from '@/components/i18n-provider';

/**
 * Open the report in a print-friendly window and hand off to the OS print dialog, which
 * reaches any installed printer (Windows, macOS, network) and "Save as PDF" alike.
 */
function printReport(table: ReportTable) {
  const esc = (s: string | number | undefined) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(table.title)}</title>
<style>
  /* Standalone print document: a separate browser window that cannot consume
     the app's CSS variables, so the Munaxa Design System token *values* are
     inlined here as rgb() (design-system/tokens/colors.ts: neutral.900,
     neutral.500, neutral.200 and brand.primarySoft, in source order below)
     rather than arbitrary CSS named colors. */
  body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color: rgb(17, 24, 39); }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .meta { color: rgb(107, 114, 128); font-size: 11px; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid rgb(229, 231, 235); padding: 5px 8px; text-align: start; }
  th { background: rgb(245, 240, 255); }
  tr { break-inside: avoid; }
  @page { margin: 14mm; }
</style>
</head>
<body>
<h1>${esc(table.title)}</h1>
<div class="meta">${table.subtitle ? `${esc(table.subtitle)} · ` : ''}Generated ${esc(
    table.generatedAt,
  )} · ${table.rows.length} row(s)</div>
<table>
<thead><tr>${table.columns.map((c) => `<th>${esc(c.header)}</th>`).join('')}</tr></thead>
<tbody>${table.rows
    .map((row) => `<tr>${table.columns.map((c) => `<td>${esc(row[c.key])}</td>`).join('')}</tr>`)
    .join('')}</tbody>
</table>
<script>window.addEventListener('load', () => { window.print(); });</script>
</body>
</html>`;
  const win = window.open('', '_blank', 'noopener,width=1000,height=700');
  if (!win) return; // popup blocked; nothing to do
  win.document.write(html);
  win.document.close();
}

const KINDS: Array<{ key: ReportKind; labelKey: string }> = [
  { key: 'attendance', labelKey: 'reports.kindAttendance' },
  { key: 'academic', labelKey: 'reports.kindAcademic' },
  { key: 'financial', labelKey: 'reports.kindFinancial' },
  { key: 'behavior', labelKey: 'reports.kindBehavior' },
];

const FORMATS: ReportFormat[] = ['csv', 'xlsx', 'pdf'];

export default function ReportsPage() {
  const { t } = useI18n();
  const [kind, setKind] = useState<ReportKind>('attendance');
  const [filters, setFilters] = useState<ReportFilters>({});
  const [table, setTable] = useState<ReportTable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function setField(key: keyof ReportFilters, value: string) {
    setFilters((f) => {
      const next = { ...f };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  }

  async function run() {
    setError(null);
    setBusy(true);
    try {
      setTable(await reportingApi.view(kind, filters));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function download(format: ReportFormat) {
    setError(null);
    try {
      await reportingApi.download(kind, format, filters);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="font-display text-2xl font-semibold">{t('nav.reports')}</h1>
          <p className="text-sm text-muted-foreground">{t('reports.subtitle')}</p>
        </header>

        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <Button
              key={k.key}
              size="sm"
              variant={kind === k.key ? 'default' : 'outline'}
              onClick={() => {
                setKind(k.key);
                setTable(null);
              }}
            >
              {t(k.labelKey)}
            </Button>
          ))}
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 pt-6">
            <Field label="Section (optional)" className="min-w-48 flex-1">
              <EntityPicker
                value={filters.sectionId ?? ''}
                onChange={(id) => setField('sectionId', id)}
                load={loadSectionOptions}
                placeholder="All sections"
              />
            </Field>
            <Field label="From">
              <Input
                type="date"
                value={filters.from ?? ''}
                onChange={(e) => setField('from', e.target.value)}
              />
            </Field>
            <Field label="To">
              <Input
                type="date"
                value={filters.to ?? ''}
                onChange={(e) => setField('to', e.target.value)}
              />
            </Field>
            <Button disabled={busy} onClick={() => void run()}>
              {busy ? t('common.loading') : t('reports.run')}
            </Button>
          </CardContent>
        </Card>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {table ? (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-medium">{table.title}</h2>
                {table.subtitle ? (
                  <Badge tone="muted" className="mt-1">
                    {table.subtitle}
                  </Badge>
                ) : null}
              </div>
              <div className="flex gap-2">
                {FORMATS.map((f) => (
                  <Button key={f} size="sm" variant="outline" onClick={() => void download(f)}>
                    {f.toUpperCase()}
                  </Button>
                ))}
                <Button size="sm" onClick={() => printReport(table)}>
                  {t('reports.print')}
                </Button>
              </div>
            </div>

            <Table>
              <THead>
                <TR>
                  {table.columns.map((c) => (
                    <TH key={c.key}>{c.header}</TH>
                  ))}
                </TR>
              </THead>
              <TBody>
                {table.rows.map((row, i) => (
                  <TR key={i}>
                    {table.columns.map((c) => (
                      <TD key={c.key}>{String(row[c.key] ?? '')}</TD>
                    ))}
                  </TR>
                ))}
                {table.rows.length === 0 ? (
                  <TR>
                    <TD className="text-muted-foreground" colSpan={table.columns.length}>
                      No data for the selected filters.
                    </TD>
                  </TR>
                ) : null}
              </TBody>
            </Table>
          </section>
        ) : null}
      </div>
    </Shell>
  );
}
