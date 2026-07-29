import { redirect } from 'next/navigation';

/**
 * The separate "Family admission" wizard is unified into the single account-first Admission wizard at
 * /admissions (which handles one or many students, new or existing accounts). This route permanently
 * redirects there (kept for one release for bookmarks).
 */
export default function FamilyAdmissionRedirect() {
  redirect('/admissions');
}
