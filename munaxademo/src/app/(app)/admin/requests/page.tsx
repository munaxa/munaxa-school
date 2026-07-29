'use client';

import { useCallback, useEffect, useState } from 'react';
import { fmtDate, num } from '@/lib/format';
import { PERSONAS, type PersonaId } from '@/lib/rbac';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  Spinner,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  useToast,
  type Tone,
} from '@axa/platform';
import { PageHeader, Kpi } from '@/components/page';

interface DemoRequest {
  id: string;
  schoolName: string;
  contactPerson: string;
  jobTitle: string;
  country: string;
  numStudents: number;
  numCampuses: number;
  email: string;
  phone: string;
  notes: string;
  status: 'NEW' | 'CONTACTED' | 'SCHEDULED' | 'APPROVED' | 'REJECTED' | 'CONVERTED';
  createdAt: string;
}

const STATUS_TONE: Record<DemoRequest['status'], Tone> = {
  NEW: 'default',
  CONTACTED: 'default',
  SCHEDULED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CONVERTED: 'success',
};
const NEXT_ACTIONS: Record<DemoRequest['status'], DemoRequest['status'][]> = {
  NEW: ['CONTACTED', 'REJECTED'],
  CONTACTED: ['SCHEDULED', 'REJECTED'],
  SCHEDULED: ['APPROVED', 'REJECTED'],
  APPROVED: ['REJECTED'],
  REJECTED: ['NEW'],
  CONVERTED: [],
};

export default function RequestsPage() {
  const toast = useToast();
  const [requests, setRequests] = useState<DemoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [provision, setProvision] = useState<DemoRequest | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/requests');
    if (!res.ok) {
      toast.error('Could not load requests.');
      setLoading(false);
      return;
    }
    const body = (await res.json()) as { requests: DemoRequest[] };
    setRequests(body.requests);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(id: string, status: DemoRequest['status']) {
    const res = await fetch(`/api/admin/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      toast.error('Action failed.');
      return;
    }
    toast.success(`Request marked ${status}.`);
    await load();
  }

  const counts = (s: DemoRequest['status']) => requests.filter((r) => r.status === s).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Demo requests"
        subtitle="Review 'Book a Demo' submissions and provision access for qualified prospects."
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="New" value={num(counts('NEW'))} tone="primary" />
        <Kpi label="Contacted" value={num(counts('CONTACTED'))} />
        <Kpi label="Scheduled" value={num(counts('SCHEDULED'))} tone="warm" />
        <Kpi label="Approved" value={num(counts('APPROVED'))} tone="cool" />
        <Kpi label="Converted" value={num(counts('CONVERTED'))} tone="cool" />
        <Kpi label="Rejected" value={num(counts('REJECTED'))} />
      </section>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-muted-foreground">
              <Spinner /> Loading…
            </div>
          ) : requests.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No demo requests yet. Submissions from the public “Book a Demo” form appear here.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>School</TH>
                  <TH>Contact</TH>
                  <TH>Country</TH>
                  <TH className="text-end">Students</TH>
                  <TH>Received</TH>
                  <TH>Status</TH>
                  <TH className="text-end">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {requests.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      {r.schoolName}
                      <span className="block text-xs text-muted-foreground">
                        {r.numCampuses} campus(es)
                      </span>
                    </TD>
                    <TD>
                      {r.contactPerson}
                      <span className="block text-xs text-muted-foreground">
                        {r.jobTitle} · {r.email}
                      </span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {r.phone}
                      </span>
                    </TD>
                    <TD>{r.country}</TD>
                    <TD className="text-end font-mono">{num(r.numStudents)}</TD>
                    <TD className="font-mono text-xs">{fmtDate(r.createdAt)}</TD>
                    <TD>
                      <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                    </TD>
                    <TD className="text-end">
                      <span className="flex flex-wrap justify-end gap-1">
                        {NEXT_ACTIONS[r.status].map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant="ghost"
                            onClick={() => setStatus(r.id, s)}
                          >
                            {s === 'CONTACTED'
                              ? 'Mark contacted'
                              : s === 'SCHEDULED'
                                ? 'Schedule'
                                : s === 'APPROVED'
                                  ? 'Approve'
                                  : s === 'REJECTED'
                                    ? 'Reject'
                                    : 'Reopen'}
                          </Button>
                        ))}
                        {r.status === 'APPROVED' ? (
                          <Button size="sm" onClick={() => setProvision(r)}>
                            Create account
                          </Button>
                        ) : null}
                      </span>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {provision ? (
        <ProvisionDialog
          request={provision}
          onClose={() => setProvision(null)}
          onDone={async () => {
            setProvision(null);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 24);
}
function genPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function ProvisionDialog({
  request,
  onClose,
  onDone,
}: {
  request: DemoRequest;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [username, setUsername] = useState(`${slugify(request.schoolName)}-demo`);
  const [password, setPassword] = useState(genPassword());
  const [role, setRole] = useState<PersonaId>('owner');
  const [expiry, setExpiry] = useState('14');
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/admin/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationName: request.schoolName,
        username,
        password,
        role,
        expiresInDays: Number(expiry),
        requestId: request.id,
      }),
    });
    const body = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      toast.error(body.error ?? 'Failed to create account.');
      return;
    }
    setCreated({ username, password });
    toast.success('Demo account provisioned. Request marked Converted.');
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-900/70 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Provision demo account · {request.schoolName}</CardTitle>
        </CardHeader>
        <CardContent>
          {created ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Account created. Share these credentials with the prospect (manually or via your
                channel of choice). They expire automatically.
              </p>
              <div className="rounded-lg border border-border bg-background/40 p-3 font-mono text-sm">
                <div>School: {request.schoolName}</div>
                <div>Username: {created.username}</div>
                <div>Password: {created.password}</div>
                <div>Role: {PERSONAS.find((p) => p.id === role)?.nameEn}</div>
                <div>Expires in: {expiry} days</div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => void onDone()}>Done</Button>
              </div>
            </div>
          ) : (
            <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
              <Field label="Username">
                <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
              </Field>
              <Field label="Password">
                <div className="flex gap-1">
                  <Input value={password} onChange={(e) => setPassword(e.target.value)} required />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPassword(genPassword())}
                  >
                    Gen
                  </Button>
                </div>
              </Field>
              <Field label="Assigned role">
                <Select value={role} onChange={(e) => setRole(e.target.value as PersonaId)}>
                  {PERSONAS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameEn}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Expires (days)">
                <Select value={expiry} onChange={(e) => setExpiry(e.target.value)}>
                  {['1', '7', '14', '30'].map((d) => (
                    <option key={d} value={d}>
                      {d} days
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="col-span-full flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Creating…' : 'Create account'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
