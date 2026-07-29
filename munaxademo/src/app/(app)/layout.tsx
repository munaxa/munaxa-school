import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { AppProviders } from '@/components/app-providers';
import { PERSONA_BY_ID, type PersonaId } from '@/lib/rbac';

/**
 * Every authenticated demo screen (dashboards, students, finance, portals, …) is
 * explicitly noindex/nofollow. This is defence-in-depth on top of the root layout's
 * default and the X-Robots-Tag header set in middleware.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

/**
 * Server guard for every authenticated page. The middleware already blocks unsigned
 * requests; this re-checks server-side and feeds the verified org/admin claims into
 * the client provider stack. No data is fetched from any backend — there isn't one.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect('/login');
  const assignedRole =
    session.role && PERSONA_BY_ID[session.role as PersonaId] ? (session.role as PersonaId) : null;
  return (
    <AppProviders org={session.org} isAdmin={session.admin} assignedRole={assignedRole}>
      {children}
    </AppProviders>
  );
}
