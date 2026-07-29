'use client';

import { useState } from 'react';
import Link from 'next/link';
import { requestPasswordReset } from '@/lib/auth';
import { useI18n } from '@/components/i18n-provider';
import { Logo } from '@/components/logo';
import { Button, Field, Input } from '@axa/platform';

/**
 * Password-reset request. Posts to the anti-enumeration endpoint (always 202) and shows a neutral
 * confirmation regardless of whether the email matches an account. Mirrors the login hero layout.
 */
// See login/page.tsx — cast for Next typedRoutes during standalone typecheck.
const loginHref = '/login' as never;

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [showSchool, setShowSchool] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    await requestPasswordReset({ email, ...(tenantSlug ? { tenantSlug } : {}) });
    setLoading(false);
    setSent(true);
  }

  return (
    <main className="flex min-h-screen">
      <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-grad-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2">
          <Logo size={36} priority />
          <span className="font-display text-xl font-semibold">Munaxa</span>
        </div>
        <div className="max-w-md space-y-4">
          <h2 className="font-display text-4xl font-bold leading-tight">{t('auth.heroTitle')}</h2>
          <p className="text-base leading-relaxed text-primary-foreground/80">
            {t('auth.heroSubtitle')}
          </p>
        </div>
        <p className="text-sm text-primary-foreground/60">{t('auth.heroFooter')}</p>
      </section>

      <section className="flex flex-1 items-center justify-center bg-background p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex items-center gap-2 lg:hidden">
            <Logo size={32} priority />
            <span className="font-display text-lg font-semibold">Munaxa</span>
          </div>

          <div className="space-y-1">
            <h1 className="font-display text-2xl font-semibold">{t('auth.resetTitle')}</h1>
            <p className="text-sm text-muted-foreground">{t('auth.resetSubtitle')}</p>
          </div>

          {sent ? (
            <div
              className="space-y-2 rounded-lg border border-border bg-muted/40 p-4 text-sm"
              role="status"
            >
              <p className="font-medium">{t('auth.resetSent')}</p>
              <p className="text-muted-foreground">{t('auth.resetSentHint')}</p>
            </div>
          ) : (
            <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
              <Field label={t('auth.email')} htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="name@school.edu.jo"
                />
              </Field>

              {showSchool ? (
                <Field label={t('auth.school')} htmlFor="tenant">
                  <Input
                    id="tenant"
                    value={tenantSlug}
                    onChange={(e) => setTenantSlug(e.target.value)}
                    placeholder="green-valley"
                    autoComplete="organization"
                  />
                </Field>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSchool(true)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {t('auth.specificSchool')}
                </button>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? `${t('common.loading')}` : t('auth.resetSubmit')}
              </Button>
            </form>
          )}

          <Link
            href={loginHref}
            className="inline-block text-sm font-medium text-primary-strong hover:underline"
          >
            {t('auth.backToSignIn')}
          </Link>
        </div>
      </section>
    </main>
  );
}
