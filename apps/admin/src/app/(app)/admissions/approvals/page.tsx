'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Select,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  useToast,
} from '@axa/platform';
import { admissionsApi, type FeeModificationRow } from '@/lib/admissions';

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
            <Table>
              <THead>
                <TR>
                  <TH>Student</TH>
                  <TH>Fee</TH>
                  <TH className="text-end">Original</TH>
                  <TH className="text-end">New</TH>
                  <TH className="text-end">Difference</TH>
                  <TH>Reason</TH>
                  <TH>Status</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {rows.map((m) => (
                  <TR key={m.id}>
                    <TD>
                      {m.enrollment
                        ? `${m.enrollment.student.firstNameEn} ${m.enrollment.student.lastNameEn}`
                        : '—'}
                    </TD>
                    <TD className="text-xs uppercase">{m.field}</TD>
                    <TD className="text-end font-mono">{m.originalValue}</TD>
                    <TD className="text-end font-mono">{m.newValue}</TD>
                    <TD className="text-end font-mono">{m.difference}</TD>
                    <TD className="max-w-[14rem] truncate" title={m.reason}>
                      {m.reason}
                    </TD>
                    <TD>
                      <Badge tone={STATUS_TONE[m.approval?.status ?? 'PENDING'] ?? 'muted'}>
                        {(m.approval?.status ?? 'PENDING').toLowerCase()}
                      </Badge>
                    </TD>
                    <TD>
                      {m.approval?.status === 'PENDING' ? (
                        <div className="flex gap-2">
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
                      ) : null}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
