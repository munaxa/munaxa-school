/**
 * Baseline demo accounts. These are intentionally shareable credentials handed to
 * prospective school owners — NOT secrets. The runtime store hashes them on load.
 *
 * Admin can create more at runtime; those live only in server memory and disappear
 * on restart (an accepted reset trigger). There is no database.
 */

import type { PersonaId } from '@/lib/rbac';

export interface SeedAccount {
  organizationName: string;
  username: string;
  password: string; // plaintext seed — hashed on ingest
  /** Days from server boot until expiry; null = never expires. */
  expiresInDays: number | null;
  status: 'ACTIVE' | 'DISABLED';
  admin?: boolean;
  /** Assigned persona for prospect accounts (locked to this role). */
  role?: PersonaId;
}

export const SEED_ACCOUNTS: SeedAccount[] = [
  // The demo administrator who reviews requests and provisions all other accounts.
  // This is the ONLY built-in account; prospect access is created from approved requests.
  {
    organizationName: 'Munaxa Demo Admin',
    username: 'munaxa-admin',
    password: 'MunaxaAdmin#2026',
    expiresInDays: null,
    status: 'ACTIVE',
    admin: true,
  },
  // Example of an already-provisioned, time-boxed prospect account (role-locked).
  // Mirrors the spec's "Future Academy / 7 days" example.
  {
    organizationName: 'Future Academy',
    username: 'futureacademy-demo',
    password: 'X9P4M2K8',
    expiresInDays: 7,
    status: 'ACTIVE',
    role: 'owner',
  },
];
