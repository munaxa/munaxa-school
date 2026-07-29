'use client';

import Link from 'next/link';
import { buttonVariants } from '@axa/platform';
import { useI18n } from '@/components/i18n-provider';
import { Logo } from '@/components/logo';

/**
 * 404 / not-found screen. Standalone (outside the authed app shell) so it renders for any
 * unmatched route. Mirrors the Munaxa brand visual: an oversized gradient numeral over a soft
 * primary bloom, brand mark, and a single route back into the app. Fully tokenized + bilingual
 * via the shared i18n catalog; follows light/dark and RTL automatically.
 */
export default function NotFound() {
  const { t } = useI18n();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
      <Link href="/" className="flex items-center gap-2" aria-label={t('common.appName')}>
        <Logo size={36} priority />
        <span className="font-display text-xl font-semibold">{t('common.appName')}</span>
      </Link>

      {/* Oversized brand numeral — the Munaxa visual anchor for the 404. */}
      <div
        className="relative mt-12 select-none"
        role="img"
        aria-label={t('notFound.illustrationAlt')}
      >
        <div
          className="absolute left-1/2 top-1/2 -z-10 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-20 blur-3xl sm:h-72 sm:w-72"
          aria-hidden
        />
        <span className="block bg-gradient-to-b from-primary to-accent-cool bg-clip-text font-display text-[7rem] font-bold leading-none tracking-tighter text-transparent sm:text-[11rem] lg:text-[13rem]">
          {t('notFound.code')}
        </span>
      </div>

      <h1 className="mt-6 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {t('notFound.title')}
      </h1>

      <p className="mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
        {t('notFound.description')}
      </p>

      <Link href="/" className={buttonVariants('default', 'lg', 'mt-9')}>
        {t('notFound.ctaHome')}
      </Link>
    </main>
  );
}
