'use client';

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import { Checkbox, EmptyState, Pagination, Table, TBody, TD, TH, THead, TR } from '@axa/platform';
import { TripBadge } from './components';
import type { StudentRow } from './lib';

const PAGE_SIZE = 25;

/**
 * Reusable, selection‑aware student table with client pagination. The body is kept
 * deliberately flat (one <TR> per row, fixed cell set) so it can be swapped for a
 * virtualized body (@tanstack/react-virtual) once /students is server‑paginated.
 */
export function StudentTable({
  rows,
  selected,
  onToggle,
  onToggleVisible,
  variant,
  emptyTitle,
  emptyDescription,
}: {
  rows: StudentRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleVisible: (ids: string[], checked: boolean) => void;
  variant: 'unassigned' | 'route';
  emptyTitle: string;
  emptyDescription?: string;
}) {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  // Keep the page in range when filters shrink the result set.
  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [page, pageCount]);

  const visible = useMemo(() => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [rows, page]);
  const visibleIds = useMemo(() => visible.map((r) => r.student.id), [visible]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someVisibleSelected = visibleIds.some((id) => selected.has(id));

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH className="w-8">
                <Checkbox
                  aria-label={t('transport.table.selectPage')}
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                  }}
                  onChange={(e) => onToggleVisible(visibleIds, e.target.checked)}
                />
              </TH>
              <TH>{t('transport.table.student')}</TH>
              <TH>{t('transport.table.studentId')}</TH>
              <TH>{t('transport.table.grade')}</TH>
              <TH>{t('transport.table.area')}</TH>
              <TH>{t('transport.table.pickup')}</TH>
              {variant === 'route' ? (
                <>
                  <TH>{t('transport.table.assignedTrip')}</TH>
                  <TH>{t('transport.table.assignedDate')}</TH>
                </>
              ) : (
                <TH>{t('transport.table.requestedTrip')}</TH>
              )}
            </TR>
          </THead>
          <TBody>
            {visible.map((row) => {
              const checked = selected.has(row.student.id);
              return (
                <TR key={row.student.id} className={checked ? 'bg-primary/5' : undefined}>
                  <TD>
                    <Checkbox
                      aria-label={row.name}
                      checked={checked}
                      onChange={() => onToggle(row.student.id)}
                    />
                  </TD>
                  <TD>
                    <span className="font-medium">{row.name}</span>
                    {row.nameAr ? (
                      <span className="block text-xs text-muted-foreground" dir="rtl">
                        {row.nameAr}
                      </span>
                    ) : null}
                  </TD>
                  <TD className="font-mono text-xs text-muted-foreground">
                    {row.student.moeStudentNumber || row.student.qrCode}
                  </TD>
                  <TD className="text-sm">{row.grade ?? '—'}</TD>
                  <TD className="text-sm">{row.area}</TD>
                  <TD className="text-sm text-muted-foreground">{row.pickup ?? '—'}</TD>
                  {variant === 'route' ? (
                    <>
                      <TD>
                        <TripBadge round={row.assignment?.tripRound} />
                      </TD>
                      <TD className="text-xs text-muted-foreground">
                        {row.assignedAt ? new Date(row.assignedAt).toLocaleDateString() : '—'}
                      </TD>
                    </>
                  ) : (
                    <TD>
                      <TripBadge round={row.assignment?.tripRound} />
                    </TD>
                  )}
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
      <Pagination
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        labels={{
          nav: t('common.pagination'),
          previous: t('common.previous'),
          next: t('common.next'),
          page: t('common.page'),
        }}
      />
    </div>
  );
}
