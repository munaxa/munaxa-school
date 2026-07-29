import { Suspense } from 'react';
import { Shell } from '@/components/shell';
import { Spinner } from '@axa/platform';
import { EmployeeProfile } from './employee-profile';

/**
 * Route: /people/employees/:employeeId — the full-page Employee (HR) workspace that replaced the
 * read-only popup. Deep-linkable tabs via `?tab=`. The Suspense boundary is required because the
 * profile reads the active tab from the URL search params.
 */
export default function EmployeeProfilePage() {
  return (
    <Shell>
      <Suspense
        fallback={
          <div className="flex justify-center py-24">
            <Spinner />
          </div>
        }
      >
        <EmployeeProfile />
      </Suspense>
    </Shell>
  );
}
