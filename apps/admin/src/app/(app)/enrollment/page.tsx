import { redirect } from 'next/navigation';

/**
 * The standalone enrollment screen has been folded into the Admissions wizard, which is the single
 * canonical registration flow: fees-first quotation → persisted quote → atomic commit that creates
 * the student/parent/enrollment and charges together (with idempotency and fee-approval support).
 * This route now redirects there so existing links and bookmarks keep working.
 */
export default function EnrollmentPage() {
  redirect('/admissions');
}
