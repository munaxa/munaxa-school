'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataGrid,
  EmptyState,
  Select,
  useToast,
  type ColumnDef,
} from '@axa/platform';
import { admissionsApi, type FeeModificationRow } from '@/lib/admissions';

/** The student the modification belongs to — what the row sorts by and is announced as. */
function studentName(row: FeeModificationRow): string {
  return row.enrollment
    ? `${row.enrollment.student.firstNameEn} ${row.enrollment.student.lastNameEn}`
    : '—';
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'muted'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

/**
 * Finance approval inbox for registrar fee modifications. Approving a modification activates the
 * enrollment that was held in PENDING_APPROVAL. Requires finance:approve.
 */
export default function ApprovalsPage() {
  const toast = useToast();
  const [status, setStatus] = useState('PENDING');
  const [rows, setRows] = useState<FeeModificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await admissionsApi.listModifications(status));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load modifications');
    } finally {
      setLoading(false);
    }
  }, [status, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, approve: boolean) {
    setBusyId(id);
    try {
      if (approve) await admissionsApi.approveModification(id);
      else await admissionsApi.rejectModification(id);
      toast.success(approve ? 'Approved' : 'Rejected');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId('');
    }
  }

  const columns = useMemo<ColumnDef<FeeModificationRow>[]>(
    () => [
      {
        id: 'student',
        header: 'Student',
        value: studentName,
        sortable: true,
        rowHeader: true,
      },
      {
        id: 'fee',
        header: 'Fee',
        value: (m) => m.field,
        sortable: true,
        cell: (m) => <span className="text-xs uppercase">{m.field}</span>,
      },
      {
        id: 'original',
        header: 'Original',
        value: (m) => m.originalValue,
        sortable: true,
        align: 'end',
        cell: (m) => <span className="font-mono">{m.originalValue}</span>,
      },
      {
        id: 'new',
        header: 'New',
        value: (m) => m.newValue,
        sortable: true,
        align: 'end',
        cell: (m) => <span className="font-mono">{m.newValue}</span>,
      },
      {
        id: 'difference',
        header: 'Difference',
        value: (m) => m.difference,
        sortable: true,
        align: 'end',
        cell: (m) => <span className="font-mono">{m.difference}</span>,
      },
      {
        id: 'reason',
        header: 'Reason',
        value: (m) => m.reason,
        sortable: true,
        // The full reason was only reachable through a title attribute; the grid clamps the cell
        // and keeps it, so hovering still tells you the rest.
        cell: (m) => <span title={m.reason}>{m.reason}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        value: (m) => m.approval?.status ?? 'PENDING',
        sortable: true,
        cell: (m) => (
          <Badge tone={STATUS_TONE[m.approval?.status ?? 'PENDING'] ?? 'muted'}>
            {(m.approval?.status ?? 'PENDING').toLowerCase()}
          </Badge>
        ),
      },
    ],
    [],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold">Fee approvals</h1>
          <p className="text-sm text-muted-foreground">
            Review registrar fee modifications. Approving activates a pending enrollment.
          </p>
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </Select>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Modifications</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <EmptyState title="Nothing here" description="No fee modifications for this status." />
          ) : (
            <DataGrid
              rows={rows}
              columns={columns}
              getRowId={(m) => m.id}
              getRowLabel={(m) => studentName(m)}
              rowActionsWidth={168}
              aria-label="Fee modifications"
              rowActions={(m) =>
                m.approval?.status === 'PENDING' ? (
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      onClick={() => void decide(m.id, true)}
                      disabled={busyId === m.id}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void decide(m.id, false)}
                      disabled={busyId === m.id}
                    >
                      Reject
                    </Button>
                  </div>
                ) : null
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
