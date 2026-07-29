import type { Metadata } from 'next';
import { Sora, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@axa/platform';

// Munaxa Design System type pairing: Sora (display) / Inter (body) / JetBrains Mono.
const sora = Sora({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Munaxa — Live Demo',
  description: 'A live, isolated demonstration of the Munaxa School Operating System.',
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
        <ToastProvider viewportClassName="z-[60]">{children}</ToastProvider>
      </body>
    </html>
  );
}
