import type { Metadata } from 'next';
import { authPageMetadata } from '@/lib/seo';

export const metadata: Metadata = authPageMetadata('/login', 'Sign in — Munaxa');

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
