'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { assetsApi, type AssetAssignment } from '@/lib/people';

export function AssetsTab({ employeeId, canManage }: { employeeId: string; canManage: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const [rows, setRows] = useState<AssetAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setRows(await assetsApi.forEmployee(employeeId));
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function returnAsset(a: AssetAssignment) {
    try {
      await assetsApi.return(a.assetId, {});
      toast.success(t('common.saved'));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('hr.assignedAssets')}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('hr.noAssets')}</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t('hr.assetTag')}</TH>
                <TH>{t('common.name')}</TH>
                <TH>{t('hr.assignedAt')}</TH>
                <TH>{t('hr.returnedAt')}</TH>
                {canManage ? <TH>{t('common.actions')}</TH> : null}
              </TR>
            </THead>
            <TBody>
              {rows.map((a) => (
                <TR key={a.id}>
                  <TD className="font-mono text-xs">{a.asset.assetTag}</TD>
                  <TD>{a.asset.name}</TD>
                  <TD className="text-xs text-muted-foreground">{a.assignedAt.slice(0, 10)}</TD>
                  <TD>
                    {a.returnedAt ? (
                      <span className="text-xs text-muted-foreground">
                        {a.returnedAt.slice(0, 10)}
                      </span>
                    ) : (
                      <Badge tone="success">{t('hr.inCustody')}</Badge>
                    )}
                  </TD>
                  {canManage ? (
                    <TD>
                      {!a.returnedAt ? (
                        <Button variant="ghost" size="sm" onClick={() => void returnAsset(a)}>
                          {t('hr.return')}
                        </Button>
                      ) : null}
                    </TD>
                  ) : null}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
