'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  useToast,
} from '@axa/platform';
import { teamApi, type LeaveRequest, type TeamMember } from '@/lib/people';

export default function MyTeamPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pending, setPending] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([
        teamApi.members(),
        teamApi.pendingLeave().catch(() => [] as LeaveRequest[]),
      ]);
      setMembers(m);
      setPending(p);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, action: 'approve' | 'reject') {
    try {
      if (action === 'approve') await teamApi.approve(id);
      else await teamApi.reject(id);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  if (loading) {
    return (
      <Shell>
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader title={t('hr.myTeam')} />

        <Card>
          <CardHeader>
            <CardTitle>{t('hr.pendingApprovals')}</CardTitle>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('hr.noPendingLeave')}</p>
            ) : (
              <ul className="divide-y divide-border">
                {pending.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">
                        {r.employee.firstNameEn} {r.employee.lastNameEn}
                      </span>
                      <span className="text-muted-foreground"> · {r.leaveType.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {r.startDate.slice(0, 10)} → {r.endDate.slice(0, 10)} ·{' '}
                        {Number(r.workingDays)} {t('hr.days')}
                        {r.reason ? ` · ${r.reason}` : ''}
                      </span>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void decide(r.id, 'approve')}
                      >
                        {t('hr.approve')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => void decide(r.id, 'reject')}
                      >
                        {t('hr.reject')}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('hr.directReports')}</CardTitle>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('hr.noReports')}</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>{t('common.name')}</TH>
                    <TH>{t('people.jobTitle')}</TH>
                    <TH>{t('people.department')}</TH>
                    <TH>{t('common.status')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {members.map((m) => (
                    <TR key={m.id}>
                      <TD>
                        {m.firstNameEn} {m.lastNameEn}
                      </TD>
                      <TD>{m.jobTitle}</TD>
                      <TD className="text-muted-foreground">{m.department?.name ?? '—'}</TD>
                      <TD>
                        <Badge tone="muted">{m.status}</Badge>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}
