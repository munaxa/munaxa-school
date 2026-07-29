import type { Metadata } from 'next';
import { authPageMetadata } from '@/lib/seo';

export const metadata: Metadata = authPageMetadata('/change-password', 'Change password — Munaxa');

export default function ChangePasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
