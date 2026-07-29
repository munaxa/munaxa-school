import { Suspense } from 'react';
import { Shell } from '@/components/shell';
import { Spinner } from '@axa/platform';
import { StudentProfile } from './student-profile';

/**
 * Route: /people/students/:studentId — the full-page Student Profile that replaced the old
 * student popup. Deep-linkable tabs via `?tab=` (e.g. ?tab=finance). The Suspense boundary is
 * required because the profile reads the tab from the URL search params.
 */
export default function StudentProfilePage() {
  return (
    <Shell>
      <Suspense
        fallback={
          <div className="flex justify-center py-24">
            <Spinner />
          </div>
        }
      >
        <StudentProfile />
      </Suspense>
    </Shell>
  );
}
