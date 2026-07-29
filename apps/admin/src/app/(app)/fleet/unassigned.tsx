'use client';

import { useMemo, useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import { Button, Card, CardContent, Field, Input, Select, useToast } from '@axa/platform';
import { busApi } from '@/lib/bus';
import { AssignDialog, BulkActionBar, SuggestAssignmentsDialog } from './components';
import { StudentTable } from './student-table';
import {
  exportRowsCsv,
  runBulk,
  tripToRound,
  useDebouncedValue,
  useSelection,
  type TransportData,
  type TripValue,
} from './lib';

/**
 * Unassigned Students — the queue of active riders without a route. Replaces the
 * "search every student in a dropdown" workflow with a filterable, bulk‑assignable list.
 */
export function UnassignedStudents({
  data,
  canAssign,
}: {
  data: TransportData;
  canAssign: boolean;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const { selected, toggle, toggleVisible, clear } = useSelection();
  const [query, setQuery] = useState('');
  const [grade, setGrade] = useState('all');
  const [gender, setGender] = useState('all');
  const [assignOpen, setAssignOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const search = useDebouncedValue(query);

  // The queue is now driven by real demand captured at registration: students whose
  // parent requested transport but who have no route yet. (Replaces "active + unassigned".)
  const unassignedRows = useMemo(
    () => data.rows.filter((r) => r.transportRequested && r.assignment === null),
    [data.rows],
  );

  const grades = useMemo(
    () => [...new Set(unassignedRows.map((r) => r.grade).filter(Boolean))].sort() as string[],
    [unassignedRows],
  );
  const genders = useMemo(
    () => [...new Set(unassignedRows.map((r) => r.student.gender).filter(Boolean))] as string[],
    [unassignedRows],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return unassignedRows.filter((r) => {
      if (grade !== 'all' && r.grade !== grade) return false;
      if (gender !== 'all' && r.student.gender !== gender) return false;
      if (
        q &&
        !r.name.toLowerCase().includes(q) &&
        !r.nameAr.includes(q) &&
        !(r.student.moeStudentNumber ?? '').toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [unassignedRows, grade, gender, search]);

  const selectedRows = useMemo(
    () => data.rows.filter((r) => selected.has(r.student.id)),
    [data.rows, selected],
  );

  async function assign(routeId: string, trip: TripValue) {
    const round = tripToRound(trip);
    const { ok, failed } = await runBulk([...selected], async (studentId) => {
      const a = await busApi.assign({ studentId, routeId, ...(round ? { tripRound: round } : {}) });
      data.mergeAssignment(a);
    });
    if (failed === 0) toast.success(`${t('transport.bulk.assigned')}: ${ok}`);
    else toast.error(`${t('transport.bulk.assigned')}: ${ok} ✓ · ${failed} ✕`);
    clear();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-2 pt-5">
          <Field label={t('common.search')} className="flex-1 min-w-48">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('fleet.searchStudents')}
            />
          </Field>
          <Field label={t('transport.table.grade')}>
            <Select value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="all">{t('transport.filter.allGrades')}</option>
              {grades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('transport.filter.gender')}>
            <Select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="all">{t('transport.filter.allGenders')}</option>
              {genders.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </Field>
          <Button size="sm" variant="outline" onClick={() => setSuggestOpen(true)}>
            {t('transport.suggest.cta')}
          </Button>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        {rows.length} {t('transport.unassigned.needTransport')}
      </p>

      <StudentTable
        rows={rows}
        selected={selected}
        onToggle={toggle}
        onToggleVisible={toggleVisible}
        variant="unassigned"
        emptyTitle={t('transport.unassigned.empty')}
        emptyDescription={t('transport.unassigned.emptyDesc')}
      />

      {canAssign ? (
        <BulkActionBar count={selected.size} onClear={clear}>
          <Button size="sm" onClick={() => setAssignOpen(true)}>
            {t('transport.bulk.assign')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => exportRowsCsv(selectedRows, 'unassigned-selected.csv')}
          >
            {t('common.export')}
          </Button>
        </BulkActionBar>
      ) : null}

      <AssignDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title={t('transport.bulk.assign')}
        count={selected.size}
        routes={data.routeVMs}
        onConfirm={assign}
      />
      <SuggestAssignmentsDialog open={suggestOpen} onClose={() => setSuggestOpen(false)} />
    </div>
  );
}
