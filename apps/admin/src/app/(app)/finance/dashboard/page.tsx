import { redirect } from 'next/navigation';

/**
 * The finance dashboard now lives inside the unified Finance workspace (/finance) — it is the
 * default state shown under the search bar. This route is kept only to redirect old links/bookmarks.
 */
export default function FinanceDashboardRedirect() {
  redirect('/finance');
}
