'use client';

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import { Button, Drawer, Field, Input, Select, useToast } from '@axa/platform';
import { busApi } from '@/lib/bus';
import {
  AssignDialog,
  BulkActionBar,
  ChangeTripDialog,
  ConfirmDialog,
  CapacityMeter,
  RouteStatusBadge,
} from './components';
import { StudentTable } from './student-table';
import {
  exportRowsCsv,
  runBulk,
  tripToRound,
  useDebouncedValue,
  useSelection,
  type RouteVM,
  type TransportData,
  type TripValue,
} from './lib';

/**
 * Route Students — opened from the Dashboard or Area Planning. Shows every rider on
 * a route with bulk Move / Unassign / Change Trip and CSV export.
 */
export function RouteStudentsDrawer({
  data,
  vm,
  canManage,
  onClose,
}: {
  data: TransportData;
  vm: RouteVM | null;
  canManage: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const { selected, toggle, toggleVisible, clear } = useSelection();
  const [query, setQuery] = useState('');
  const [trip, setTrip] = useState<TripValue | 'all'>('all');
  const [moveOpen, setMoveOpen] = useState(false);
  const [tripOpen, setTripOpen] = useState(false);
  const [unassignOpen, setUnassignOpen] = useState(false);
  const search = useDebouncedValue(query);

  // Reset transient state whenever a different route is opened/closed.
  useEffect(() => {
    clear();
    setQuery('');
    setTrip('all');
  }, [vm?.route.id, clear]);

  const rows = useMemo(() => {
    if (!vm) return [];
    const q = search.trim().toLowerCase();
    return data.rows.filter((r) => {
      if (r.assignment?.routeId !== vm.route.id) return false;
      if (trip !== 'all') {
        const round = r.assignment?.tripRound ?? null;
        if (trip === '1' && !(round === 1 || round === 3)) return false;
        if (trip === '2' && !(round === 2 || round === 3)) return false;
        if (trip === '3' && round !== 3) return false;
      }
      if (q && !r.name.toLowerCase().includes(q) && !r.nameAr.includes(q)) return false;
      return true;
    });
  }, [data.rows, vm, trip, search]);

  const selectedRows = useMemo(
    () => data.rows.filter((r) => selected.has(r.student.id)),
    [data.rows, selected],
  );

  function summarize(label: string, ok: number, failed: number) {
    if (failed === 0) toast.success(`${label}: ${ok}`);
    else toast.error(`${label}: ${ok} ✓ · ${failed} ✕`);
  }

  async function move(routeId: string, t2: TripValue) {
    const round = tripToRound(t2);
    const { ok, failed } = await runBulk([...selected], async (studentId) => {
      const a = await busApi.assign({ studentId, routeId, ...(round ? { tripRound: round } : {}) });
      data.mergeAssignment(a);
    });
    summarize(t('transport.bulk.moved'), ok, failed);
    clear();
  }

  async function changeTrip(t2: TripValue) {
    if (!vm) return;
    const round = tripToRound(t2);
    const { ok, failed } = await runBulk([...selected], async (studentId) => {
      const a = await busApi.assign({
        studentId,
        routeId: vm.route.id,
        ...(round ? { tripRound: round } : {}),
      });
      data.mergeAssignment(a);
    });
    summarize(t('transport.bulk.tripChanged'), ok, failed);
    clear();
  }

  async function unassign() {
    const targets = selectedRows
      .map((r) => r.assignment?.id)
      .filter((id): id is string => Boolean(id));
    const { ok, failed } = await runBulk(targets, async (id) => {
      await busApi.unassign(id);
      data.removeAssignment(id);
    });
    summarize(t('transport.bulk.unassigned'), ok, failed);
    clear();
  }

  return (
    <Drawer
      open={vm !== null}
      onClose={onClose}
      title={vm ? `${t('transport.routeStudents.title')} — ${vm.route.name}` : ''}
    >
      {vm ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <RouteStatusBadge capacity={vm.capacity} />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => exportRowsCsv(rows, `${vm.route.name}-students.csv`)}
            >
              {t('common.export')}
            </Button>
          </div>
          <CapacityMeter capacity={vm.capacity} />

          <div className="flex flex-wrap items-end gap-2">
            <Field label={t('common.search')} className="flex-1 min-w-40">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('fleet.searchStudents')}
              />
            </Field>
            <Field label={t('fleet.trip')}>
              <Select value={trip} onChange={(e) => setTrip(e.target.value as TripValue | 'all')}>
                <option value="all">{t('transport.filter.allTrips')}</option>
                <option value="">{t('transport.trip.none')}</option>
                <option value="1">{t('transport.trip.first')}</option>
                <option value="2">{t('transport.trip.second')}</option>
                <option value="3">{t('transport.trip.both')}</option>
              </Select>
            </Field>
          </div>

          <StudentTable
            rows={rows}
            selected={selected}
            onToggle={toggle}
            onToggleVisible={toggleVisible}
            variant="route"
            emptyTitle={t('transport.routeStudents.empty')}
          />

          {canManage ? (
            <BulkActionBar count={selected.size} onClear={clear}>
              <Button size="sm" onClick={() => setMoveOpen(true)}>
                {t('transport.bulk.move')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setTripOpen(true)}>
                {t('transport.bulk.changeTrip')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setUnassignOpen(true)}>
                {t('transport.bulk.unassign')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => exportRowsCsv(selectedRows, `${vm.route.name}-selected.csv`)}
              >
                {t('common.export')}
              </Button>
            </BulkActionBar>
          ) : null}

          <AssignDialog
            open={moveOpen}
            onClose={() => setMoveOpen(false)}
            title={t('transport.bulk.move')}
            count={selected.size}
            routes={data.routeVMs}
            defaultRouteId={vm.route.id}
            onConfirm={move}
          />
          <ChangeTripDialog
            open={tripOpen}
            onClose={() => setTripOpen(false)}
            count={selected.size}
            onConfirm={changeTrip}
          />
          <ConfirmDialog
            open={unassignOpen}
            onClose={() => setUnassignOpen(false)}
            title={t('transport.bulk.unassign')}
            message={t('transport.bulk.unassignConfirm')}
            confirmLabel={t('transport.bulk.unassign')}
            onConfirm={unassign}
          />
        </div>
      ) : null}
    </Drawer>
  );
}
