import type { Metadata } from 'next';
import { DEMO_SITE_URL, demoUrl } from '@/lib/seo';

/**
 * The "Request a Demo" page is the one public, prospect-facing surface of the demo app,
 * so it opts back in to indexing (the root layout is noindex by default) with full,
 * self-canonical metadata. The page component itself is a client component, so its SEO
 * metadata lives here in a server layout.
 */
const TITLE = 'Request a Munaxa Demo — School Operating System';
const DESCRIPTION =
  'Book a live, guided demo of Munaxa — the enterprise School Operating System for private ' +
  'and international schools in Jordan and the MENA region. See admissions, finance, ' +
  'attendance and parent communication in action.';

export const metadata: Metadata = {
  metadataBase: new URL(DEMO_SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/request-demo' },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    type: 'website',
    url: demoUrl('/request-demo'),
    siteName: 'Munaxa',
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: TITLE,
  description: DESCRIPTION,
  url: demoUrl('/request-demo'),
  isPartOf: { '@type': 'WebSite', name: 'Munaxa', url: DEMO_SITE_URL },
};

export default function RequestDemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
