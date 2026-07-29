import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Orbix Studio — Design System',
  description:
    'Orbix Studio design system clone — a shadcn/ui theme (preset b7BFbeatk) showcase built with Next.js 15.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
