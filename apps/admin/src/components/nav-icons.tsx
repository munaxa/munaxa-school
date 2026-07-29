import type { SVGProps } from 'react';

/**
 * Lightweight stroke icon set for the sidebar navigation (no external icon dependency).
 * 24×24, currentColor, 1.75 stroke — tuned to sit on the icon rail. Each nav item references
 * one by key via {@link NavIcon}.
 */
type IconKey =
  | 'dashboard'
  | 'enrollment'
  | 'students'
  | 'teachers'
  | 'parents'
  | 'employees'
  | 'cards'
  | 'timetable'
  | 'attendance'
  | 'presence'
  | 'academics'
  | 'finance'
  | 'collections'
  | 'feePlans'
  | 'feeConfig'
  | 'communication'
  | 'fleet'
  | 'library'
  | 'inventory'
  | 'clinic'
  | 'reports'
  | 'structure'
  | 'academicStructure'
  | 'modules'
  | 'integrations'
  | 'settings'
  | 'users'
  | 'roles'
  | 'databases';

const PATHS: Record<IconKey, React.ReactNode> = {
  dashboard: <path d="M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />,
  enrollment: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0M18 8v6M21 11h-6" />
    </>
  ),
  students: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 5.2a3.2 3.2 0 0 1 0 5.6M21.5 20a5.6 5.6 0 0 0-4-5.4" />
    </>
  ),
  teachers: (
    <>
      <path d="m12 4 9 4-9 4-9-4 9-4Z" />
      <path d="M7 10v4c0 1.5 2.2 2.8 5 2.8s5-1.3 5-2.8v-4M21 8v5" />
    </>
  ),
  parents: (
    <>
      <circle cx="8" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M2.5 19a5.5 5.5 0 0 1 11 0M15 19a4.2 4.2 0 0 1 6.5-3.5" />
    </>
  ),
  employees: (
    <>
      <rect x="3" y="7.5" width="18" height="12" rx="2" />
      <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3 12h18" />
    </>
  ),
  cards: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3 9.5h18M6.5 14.5h4" />
    </>
  ),
  timetable: (
    <>
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
      <path d="M3.5 9h17M8 3v3M16 3v3M8 13h2M14 13h2M8 16.5h2M14 16.5h2" />
    </>
  ),
  attendance: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  presence: (
    <>
      <path d="M14 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" />
      <path d="M10 8 6 12l4 4M6 12h8" />
    </>
  ),
  academics: (
    <>
      <path d="m12 4 10 4-10 4L2 8l10-4Z" />
      <path d="M6 10v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
    </>
  ),
  finance: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M6.5 9.5h.01M17.5 14.5h.01" />
    </>
  ),
  collections: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5M12 16h.01" />
    </>
  ),
  feePlans: (
    <>
      <path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8V3.5Z" />
      <path d="M9 8h6M9 11.5h6M9 15h3" />
    </>
  ),
  feeConfig: (
    <>
      <path d="M5 7h14M5 12h14M5 17h14" />
      <circle cx="9" cy="7" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  communication: (
    <>
      <path d="m3 11 14-6v14L3 13v-2Z" />
      <path d="M7 12.5V18a1.5 1.5 0 0 0 3 0v-4M17 8a3 3 0 0 1 0 6" />
    </>
  ),
  fleet: (
    <>
      <rect x="3" y="5" width="18" height="11" rx="2" />
      <path d="M3 11h18M7 16v2M17 16v2" />
      <circle cx="8" cy="16" r="1.4" />
      <circle cx="16" cy="16" r="1.4" />
    </>
  ),
  library: (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15.5H5.5A1.5 1.5 0 0 0 4 21V5.5Z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15.5h5.5A1.5 1.5 0 0 1 20 21V5.5Z" />
    </>
  ),
  inventory: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </>
  ),
  clinic: (
    <>
      <path d="M20 12.5A8 8 0 1 1 11.5 4.05" />
      <path d="M16 3v6M13 6h6" />
      <path d="M7 12.5h2l1.5 3 2-6 1 3H17" />
    </>
  ),
  reports: (
    <>
      <path d="M4 20h16M7 20v-7M12 20V7M17 20v-4" />
    </>
  ),
  structure: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="1.5" />
      <path d="M8 8h2M14 8h2M8 12h2M14 12h2M8 16h2M14 16h2" />
    </>
  ),
  academicStructure: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5M3 17l9 5 9-5" />
    </>
  ),
  modules: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  integrations: (
    <>
      <path d="M9 3v5M15 3v5" />
      <path d="M7 8h10v3a5 5 0 0 1-10 0V8ZM12 16v5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13a7.7 7.7 0 0 0 0-2l1.8-1.2-2-3.4L17 7.2a7.6 7.6 0 0 0-1.7-1L15 4H9l-.3 2.2a7.6 7.6 0 0 0-1.7 1L4.8 6.4l-2 3.4L4.6 11a7.7 7.7 0 0 0 0 2l-1.8 1.2 2 3.4L7 16.8a7.6 7.6 0 0 0 1.7 1L9 20h6l.3-2.2a7.6 7.6 0 0 0 1.7-1l2.2.8 2-3.4L19.4 13Z" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 5.2a3.2 3.2 0 0 1 0 5.6M21.5 20a5.6 5.6 0 0 0-4-5.4" />
    </>
  ),
  roles: (
    <>
      <path d="M12 3.5 5 6v5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-2.5Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  databases: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
    </>
  ),
};

export type NavIconKey = IconKey;

/** Render a navigation icon by key. */
export function NavIcon({ name, ...props }: { name: IconKey } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
