'use client';

import { useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import { ADVANCED_MODULES, advancedApi, type FeatureFlag } from '@/lib/advanced';
import { Button, Card, CardContent, Page, PageHeader, Stack } from '@axa/platform';

export default function ModulesPage() {
  const { t } = useI18n();
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setError(null);
    try {
      const list: FeatureFlag[] = await advancedApi.flags();
      const map: Record<string, boolean> = {};
      for (const f of list) map[f.key] = f.enabled;
      setFlags(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggle(key: string) {
    setError(null);
    const next = !flags[key];
    setFlags((f) => ({ ...f, [key]: next }));
    try {
      await advancedApi.setFlag(key, next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
      setFlags((f) => ({ ...f, [key]: !next })); // revert
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
      <Page width="content">
        <PageHeader title={t('nav.modules')} description={t('modules.subtitle')} />

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Stack as="ul" gap={3}>
          {ADVANCED_MODULES.map((m) => {
            const on = flags[m.key] ?? false;
            return (
              <li key={m.key}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-medium">{m.label}</p>
                      <p className="text-sm text-muted-foreground">{m.description}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={on ? 'default' : 'outline'}
                      onClick={() => void toggle(m.key)}
                      aria-pressed={on}
                    >
                      {on ? t('modules.enabled') : t('modules.disabled')}
                    </Button>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </Stack>
      </Page>
    </Shell>
  );
}
