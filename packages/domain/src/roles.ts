/**
 * Munaxa role definitions. Two planes: Platform (cross-tenant) and School (tenant-scoped).
 * Framework-free — safe to import from API, Admin, and tooling.
 */

export const PlatformRole = {
  PlatformOwner: 'PlatformOwner',
  PlatformAdmin: 'PlatformAdmin',
  PlatformFinance: 'PlatformFinance',
  PlatformSupport: 'PlatformSupport',
  PlatformSales: 'PlatformSales',
  PlatformReadOnly: 'PlatformReadOnly',
  // Legacy support persona (kept for backward compatibility; superseded by PlatformSupport).
  SupportAgent: 'SupportAgent',
} as const;
export type PlatformRole = (typeof PlatformRole)[keyof typeof PlatformRole];

export const SchoolRole = {
  SchoolAdmin: 'SchoolAdmin',
  Principal: 'Principal',
  VicePrincipal: 'VicePrincipal',
  FinanceOfficer: 'FinanceOfficer',
  Accountant: 'Accountant',
  Teacher: 'Teacher',
  Secretary: 'Secretary',
  Receptionist: 'Receptionist',
  Registrar: 'Registrar',
  Counselor: 'Counselor',
  HR: 'HR',
  Nurse: 'Nurse',
  Librarian: 'Librarian',
  StoreKeeper: 'StoreKeeper',
  FleetAdmin: 'FleetAdmin',
  BusSupervisor: 'BusSupervisor',
  Parent: 'Parent',
  Student: 'Student',
} as const;
export type SchoolRole = (typeof SchoolRole)[keyof typeof SchoolRole];

export type Role = PlatformRole | SchoolRole;

/** All role keys (platform + school). Mirrors the Prisma `RoleKey` enum. */
export const RoleKey = {
  ...PlatformRole,
  ...SchoolRole,
} as const;
export type RoleKey = (typeof RoleKey)[keyof typeof RoleKey];

export const PLATFORM_ROLES: PlatformRole[] = Object.values(PlatformRole);
export const SCHOOL_ROLES: SchoolRole[] = Object.values(SchoolRole);
export const ALL_ROLES: Role[] = [...PLATFORM_ROLES, ...SCHOOL_ROLES];

export function isPlatformRole(role: string): role is PlatformRole {
  return (PLATFORM_ROLES as string[]).includes(role);
}

export function isSchoolRole(role: string): role is SchoolRole {
  return (SCHOOL_ROLES as string[]).includes(role);
}
