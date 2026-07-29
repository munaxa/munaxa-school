'use client';

import { useCallback, useEffect, useState } from 'react';
import { fmtDateTime, fmtDate } from '@/lib/format';
import { PERSONAS, PERSONA_BY_ID, type PersonaId } from '@/lib/rbac';
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
import { PageHeader } from '@/components/page';

interface Account {
  id: string;
  organizationName: string;
  username: string;
  createdAt: string;
  expiresAt: string | null;
  status: 'ACTIVE' | 'DISABLED';
  admin: boolean;
  role: PersonaId | null;
}
interface LoginEvent {
  id: string;
  username: string;
  at: string;
  outcome: 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'DISABLED';
  ip: string;
}

const OUTCOME_TONE: Record<LoginEvent['outcome'], Tone> = {
  SUCCESS: 'success',
  FAILED: 'danger',
  EXPIRED: 'warning',
  DISABLED: 'muted',
};

export default function AccountsPage() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [history, setHistory] = useState<LoginEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [org, setOrg] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<PersonaId>('owner');
  const [expiry, setExpiry] = useState('14');

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/accounts');
    if (!res.ok) {
      toast.error('Could not load accounts.');
      setLoading(false);
      return;
    }
    const body = (await res.json()) as { accounts: Account[]; history: LoginEvent[] };
    setAccounts(body.accounts);
    setHistory(body.history);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationName: org,
        username,
        password,
        role,
        expiresInDays: expiry === 'never' ? null : Number(expiry),
      }),
    });
    const body = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast.error(body.error ?? 'Failed to create account.');
      return;
    }
    toast.success(`Demo account "${username}" created.`);
    setOrg('');
    setUsername('');
    setPassword('');
    await load();
  }

  async function patch(id: string, payload: Record<string, unknown>, ok: string) {
    const res = await fetch(`/api/admin/accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      toast.error('Action failed.');
      return;
    }
    toast.success(ok);
    await load();
  }

  async function remove(id: string, name: string) {
    const res = await fetch(`/api/admin/accounts/${id}`, { method: 'DELETE' });
    const body = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast.error(body.error ?? 'Cannot delete.');
      return;
    }
    toast.success(`Deleted "${name}".`);
    await load();
  }

  function randomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    setPassword(
      Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''),
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Demo accounts"
        subtitle="Create time-boxed credentials for prospects. Accounts live in server memory and reset on restart."
      />

      <Card>
        <CardHeader>
          <CardTitle>Create demo account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="School name">
              <Input
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                placeholder="Future Academy"
                required
              />
            </Field>
            <Field label="Username">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="futureacademy-demo"
                required
              />
            </Field>
            <Field label="Password">
              <div className="flex gap-1">
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="X9P4M2K8"
                  required
                />
                <Button type="button" variant="outline" size="sm" onClick={randomPassword}>
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
            <Field label="Expiration">
              <Select value={expiry} onChange={(e) => setExpiry(e.target.value)}>
                <option value="1">1 day</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="never">Never</option>
              </Select>
            </Field>
            <div className="flex items-end justify-end">
              <Button type="submit" className="w-full sm:w-auto">
                Create account
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-muted-foreground">
              <Spinner /> Loading…
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>School</TH>
                  <TH>Username</TH>
                  <TH>Role</TH>
                  <TH>Created</TH>
                  <TH>Expires</TH>
                  <TH>Status</TH>
                  <TH className="text-end">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {accounts.map((a) => {
                  const expired = a.expiresAt && new Date(a.expiresAt).getTime() < Date.now();
                  return (
                    <TR key={a.id}>
                      <TD>{a.organizationName}</TD>
                      <TD className="font-mono text-xs">{a.username}</TD>
                      <TD>
                        {a.admin ? (
                          <Badge tone="default">Admin</Badge>
                        ) : a.role ? (
                          <Badge tone="muted">{PERSONA_BY_ID[a.role]?.nameEn ?? a.role}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Any</span>
                        )}
                      </TD>
                      <TD className="font-mono text-xs">{fmtDate(a.createdAt)}</TD>
                      <TD className="font-mono text-xs">
                        {a.expiresAt ? fmtDate(a.expiresAt) : 'Never'}
                      </TD>
                      <TD>
                        <Badge
                          tone={expired ? 'warning' : a.status === 'ACTIVE' ? 'success' : 'muted'}
                        >
                          {expired ? 'EXPIRED' : a.status}
                        </Badge>
                      </TD>
                      <TD className="text-end">
                        {a.admin ? (
                          <span className="text-xs text-muted-foreground">admin</span>
                        ) : (
                          <span className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                patch(
                                  a.id,
                                  { status: a.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' },
                                  a.status === 'ACTIVE' ? 'Account disabled.' : 'Account enabled.',
                                )
                              }
                            >
                              {a.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                patch(a.id, { expiresInDays: 7 }, 'Expiry extended by 7 days.')
                              }
                            >
                              +7d
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => remove(a.id, a.username)}
                            >
                              Delete
                            </Button>
                          </span>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Login history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>When</TH>
                <TH>Username</TH>
                <TH>Outcome</TH>
                <TH>IP</TH>
              </TR>
            </THead>
            <TBody>
              {history.slice(0, 20).map((h) => (
                <TR key={h.id}>
                  <TD className="font-mono text-xs">{fmtDateTime(h.at)}</TD>
                  <TD className="font-mono text-xs">{h.username}</TD>
                  <TD>
                    <Badge tone={OUTCOME_TONE[h.outcome]}>{h.outcome}</Badge>
                  </TD>
                  <TD className="font-mono text-xs">{h.ip}</TD>
                </TR>
              ))}
              {history.length === 0 ? (
                <TR>
                  <TD colSpan={4} className="text-muted-foreground">
                    No logins yet.
                  </TD>
                </TR>
              ) : null}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
