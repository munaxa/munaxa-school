import type { Metadata } from 'next';
import { Sora, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import {
  BrandProvider,
  ToastProvider,
  brandIcons,
  brandOpenGraphImage,
  productBrands,
} from '@munaxa/ui';

// Munaxa Design System type pairing: Sora (display) / Inter (body) / JetBrains Mono.
const sora = Sora({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

const brand = productBrands.school;
const DESCRIPTION = 'A live, isolated demonstration of the Munaxa School Operating System.';

/**
 * The demo is Munaxa School, so it is branded as Munaxa School.
 *
 * A demonstration that showed a different mark from the product it demonstrates would be
 * teaching the wrong thing. `robots` stays off: this is a sandbox, not a page to index.
 */
export const metadata: Metadata = {
  title: { default: `${brand.name} — Live Demo`, template: `%s · ${brand.name}` },
  description: DESCRIPTION,
  applicationName: brand.name,
  icons: brandIcons(brand),
  openGraph: {
    type: 'website',
    siteName: brand.name,
    title: `${brand.name} — Live Demo`,
    description: DESCRIPTION,
    images: [brandOpenGraphImage(brand)],
  },
  twitter: { card: 'summary_large_image', images: [brandOpenGraphImage(brand).url] },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`dark ${sora.variable} ${inter.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background bg-grad-hero font-body text-foreground antialiased">
        <BrandProvider product="school">
          <ToastProvider viewportClassName="z-[60]">{children}</ToastProvider>
        </BrandProvider>
      </body>
    </html>
  );
}
