import type { Metadata } from 'next';
import { authPageMetadata } from '@/lib/seo';

export const metadata: Metadata = authPageMetadata('/forgot-password', 'Reset password — Munaxa');

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
