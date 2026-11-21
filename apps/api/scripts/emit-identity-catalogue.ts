/*
 * Emits School's permission vocabulary in Identity's grant form (`school:<permission>`), for
 * munaxa-identity to copy into `artifacts/school-permissions.json` and seed School roles from, the
 * way it consumes Work's `work-permissions.json` (SC-07, docs/security/identity-integration.md).
 *
 * Exactly the grants School honours: every declared permission except the platform plane, which an
 * organisation role can never carry into a school (src/auth/identity/school-grants.ts).
 *
 * Usage: pnpm --filter @school/api identity:catalogue > school-permissions.json
 */
import { ALL_PERMISSIONS } from '@school/domain';
import { schoolGrantFor, schoolPermissionFrom } from '../src/auth/identity/school-grants';

const grants = ALL_PERMISSIONS.map(schoolGrantFor)
  .filter((grant) => 'permission' in schoolPermissionFrom(grant))
  .sort();

process.stdout.write(`${JSON.stringify(grants, null, 2)}\n`);
