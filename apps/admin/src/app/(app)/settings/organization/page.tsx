'use client';

import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Shell, usePrincipal } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import {
  Button,
  ErrorState,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@axa/platform';
import { organizationApi, type OrganizationSettings } from '@/lib/organization';
import {
  AcademicSection,
  AdvancedSection,
  BrandingSection,
  CommunicationSection,
  ComplianceSection,
  ContactSection,
  DocumentsSection,
  GeneralSection,
  SocialSection,
  type SectionProps,
} from './sections';

type TabKey =
  | 'general'
  | 'branding'
  | 'contact'
  | 'documents'
  | 'communication'
  | 'academic'
  | 'compliance'
  | 'social'
  | 'advanced';

/** Each tab declares the permission required to edit it (read access is gated at the nav level). */
const TABS: { key: TabKey; perm: string; Section: (p: SectionProps) => ReactElement }[] = [
  { key: 'general', perm: 'organization:update', Section: GeneralSection },
  { key: 'branding', perm: 'organization:branding', Section: BrandingSection },
  { key: 'contact', perm: 'organization:update', Section: ContactSection },
  { key: 'documents', perm: 'organization:documents', Section: DocumentsSection },
  { key: 'communication', perm: 'organization:communication', Section: CommunicationSection },
  { key: 'academic', perm: 'organization:update', Section: AcademicSection },
  { key: 'compliance', perm: 'organization:compliance', Section: ComplianceSection },
  { key: 'social', perm: 'organization:update', Section: SocialSection },
  { key: 'advanced', perm: 'organization:advanced', Section: AdvancedSection },
];

export default function OrganizationSettingsPage() {
  const { t } = useI18n();
  const principal = usePrincipal();
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('general');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSettings(await organizationApi.get());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSaved = useCallback((next: OrganizationSettings) => setSettings(next), []);

  const has = (perm: string) =>
    principal.permissions.includes(perm) || principal.permissions.includes('organization:update');

  return (
    <Shell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold">{t('organization.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('organization.subtitle')}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : error ? (
          <ErrorState
            title={t('organization.loadFailed')}
            description={error}
            action={
              <Button variant="outline" size="sm" onClick={() => void load()}>
                {t('organization.retry')}
              </Button>
            }
          />
        ) : settings ? (
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="space-y-6">
            <TabsList className="flex flex-wrap gap-1 overflow-x-auto rounded-lg bg-secondary p-1">
              {TABS.map(({ key }) => (
                <TabsTrigger key={key} value={key}>
                  {t(`organization.tab_${key}`)}
                </TabsTrigger>
              ))}
            </TabsList>
            {TABS.map(({ key, perm, Section }) => (
              <TabsContent key={key} value={key}>
                <Section settings={settings} onSaved={onSaved} canEdit={has(perm)} />
              </TabsContent>
            ))}
          </Tabs>
        ) : null}
      </div>
    </Shell>
  );
}
