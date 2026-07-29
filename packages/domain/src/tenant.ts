/** Tenant lifecycle and core domain constants. */

export const TenantStatus = {
  Provisioning: 'Provisioning',
  Active: 'Active',
  Suspended: 'Suspended',
  Archived: 'Archived',
} as const;
export type TenantStatus = (typeof TenantStatus)[keyof typeof TenantStatus];

export const TenantType = {
  School: 'School',
} as const;
export type TenantType = (typeof TenantType)[keyof typeof TenantType];

/** Supported external LMS providers — integration is via deep links only. */
export const LmsProvider = {
  GoogleClassroom: 'GoogleClassroom',
  MicrosoftTeams: 'MicrosoftTeams',
} as const;
export type LmsProvider = (typeof LmsProvider)[keyof typeof LmsProvider];

/** Currency is fixed to Jordanian Dinar for the primary market. */
export const CURRENCY = 'JOD' as const;
