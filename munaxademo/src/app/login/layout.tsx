import type { Metadata } from 'next';
import { DEMO_SITE_URL } from '@/lib/seo';

/**
 * The demo login page is public but must never be indexed (it is an auth surface, not
 * content). It still gets a self-referential canonical so that any query-string variants
 * (e.g. ?next=…) consolidate to one clean URL rather than creating duplicate/soft-404s.
 */
export const metadata: Metadata = {
  metadataBase: new URL(DEMO_SITE_URL),
  title: 'Sign in — Munaxa Demo',
  description: 'Sign in to the Munaxa live demo.',
  alternates: { canonical: '/login' },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
