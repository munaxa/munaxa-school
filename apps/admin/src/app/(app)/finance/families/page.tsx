import { redirect } from 'next/navigation';

/**
 * The former "Family finance" screen has been unified into the single account-first Finance console
 * at /finance. This route now permanently redirects there (kept for one release for bookmarks).
 */
export default function FamilyFinanceRedirect() {
  redirect('/finance');
}
