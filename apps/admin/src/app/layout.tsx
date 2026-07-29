import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { PostHogProvider } from '@/lib/posthog';
import { ToastProvider } from '@axa/platform';
import { ConfirmProvider } from '@/components/confirm';
import { I18nProvider } from '@/components/i18n-provider';
import { DEFAULT_LOCALE, directionForLocale } from '@/lib/i18n';

// Munaxa Design System typography: IBM Plex Sans (Latin) + IBM Plex Sans Arabic (RTL),
// per design-system/tokens/typography.ts. Mono falls back to the reference system stack
// (configured in the Tailwind preset). Self-hosted (variable Latin + static Arabic weights)
// so builds don't depend on Google Fonts / CDN network access.
// `display` and `body` both resolve to IBM Plex Sans; Next content-hashes the file, so the two
// instances share a single emitted asset (one download).
const plexDisplay = localFont({
  src: '../fonts/IBMPlexSans-latin.woff2',
  weight: '100 700',
  variable: '--font-display',
  display: 'swap',
});
const plexBody = localFont({
  src: '../fonts/IBMPlexSans-latin.woff2',
  weight: '100 700',
  variable: '--font-body',
  display: 'swap',
});
const plexArabic = localFont({
  src: [
    { path: '../fonts/IBMPlexSansArabic-400.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/IBMPlexSansArabic-600.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/IBMPlexSansArabic-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-arabic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Munaxa — School Operating System',
  description: 'Munaxa: a multi-tenant School Operating System for K-12 schools.',
  // Authenticated product surface — never indexable. This is the app-wide default;
  // the auth pages add self-canonicals on top (see their per-route layouts).
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

/**
 * Root layout. Locale & direction default here; per-request locale resolution and the
 * locale switcher are wired in Phase 3 alongside auth/session. Brand fonts are exposed as
 * CSS variables consumed by the Tailwind preset (font-display / font-body / font-mono).
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = DEFAULT_LOCALE;
  const dir = directionForLocale(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${plexDisplay.variable} ${plexBody.variable} ${plexArabic.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background bg-grad-hero bg-fixed font-body text-foreground antialiased">
        {/* Apply the saved theme before paint (light-first default) so it's reliable on every
            page and free of flash. The toggle keeps it in sync thereafter. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('munaxa.theme')==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
        <PostHogProvider>
          <I18nProvider>
            <ToastProvider>
              <ConfirmProvider>{children}</ConfirmProvider>
            </ToastProvider>
          </I18nProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
