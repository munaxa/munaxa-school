import type { Metadata, Viewport } from 'next';
import { Sora, Inter, Cairo, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { SITE_NAME, SITE_URL, THEME_COLOR_LIGHT, THEME_COLOR_DARK } from '@/lib/site';

const sora = Sora({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
// munaxadesignsystem: Cairo backs --font-arabic, used for display/body type when dir="rtl".
const cairo = Cairo({ subsets: ['latin', 'arabic'], variable: '--font-arabic', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const description =
  'Munaxa is the School Operating System that connects admissions, academics, attendance, ' +
  'finance, transportation and communication into one platform — so every department runs on ' +
  'the same live data.';

export const viewport: Viewport = {
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLOR_LIGHT },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLOR_DARK },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Munaxa — The School Operating System',
    template: '%s — Munaxa',
  },
  description,
  applicationName: SITE_NAME,
  keywords: [
    'school operating system',
    'school management software',
    'student information system',
    'K-12 school platform',
    'school administration',
    'school finance',
    'JoFotara e-invoicing',
    'Munaxa',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: 'Munaxa — The School Operating System',
    description,
    url: SITE_URL,
    locale: 'en_US',
    images: [{ url: '/logo.png', width: 640, height: 427, alt: 'Munaxa' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Munaxa — The School Operating System',
    description,
  },
  robots: { index: true, follow: true },
};

// Adds `js` (enables scroll-reveal) and applies stored/OS theme before paint — no FOUC.
const bootScript = `(function(){try{var d=document.documentElement;d.classList.add('js');var t=localStorage.getItem('munaxa-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){d.classList.add('dark');}}catch(e){}})();`;

const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description,
};
const softwareJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description,
  offers: { '@type': 'Offer', category: 'Subscription' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${sora.variable} ${inter.variable} ${cairo.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="min-h-screen bg-background font-body text-foreground antialiased">
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
        />
      </body>
    </html>
  );
}
