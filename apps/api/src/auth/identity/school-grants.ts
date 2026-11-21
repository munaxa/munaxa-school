import { ALL_PERMISSIONS, type Permission } from '@school/domain';

/**
 * Turning what Identity granted into School permissions (SC-07). The same contract as Munaxa Work's
 * `platform-grants.ts` (Work ADR-0076): each product owns its vocabulary, Identity carries the grant.
 *
 * School's permission names are already Identity's grammar (`resource:action`, colon-separated
 * lower-case segments), so the grant for `student:manage` is `school:student:manage`. Rules, in
 * order, each of which drops rather than repairs:
 *
 * 1. **No pattern.** A grant containing `*` confers nothing. There is no expansion.
 * 2. **Namespace.** Only `school:` is School's. Another product's grant is somebody else's authority.
 * 3. **Grammar.** What follows the namespace must be Identity's segment grammar.
 * 4. **Catalogue.** The result must be a permission School declares (`ALL_PERMISSIONS`).
 * 5. **Not the platform plane.** `platform:*` and `support:impersonate` are Munaxa staff powers.
 *    An Identity organisation is a customer organisation, so an organisation role can never carry
 *    them into a school; the platform console keeps its own sign-in until that is designed.
 */

export const SCHOOL_GRANT_NAMESPACE = 'school:';

const SEGMENTS = /^[a-z0-9][a-z0-9_-]*(?::[a-z0-9][a-z0-9_-]*)*$/;
const DECLARED: ReadonlySet<string> = new Set(ALL_PERMISSIONS);
const PLATFORM_PLANE = (permission: string): boolean =>
  permission.startsWith('platform:') || permission === 'support:impersonate';

export type DroppedGrantReason =
  'wildcard' | 'not-a-school-grant' | 'malformed' | 'not-a-declared-permission' | 'platform-plane';

export interface DroppedGrant {
  readonly grant: string;
  readonly reason: DroppedGrantReason;
}

/** The grant Identity records for a School permission. Used by the role-seed artifact. */
export const schoolGrantFor = (permission: Permission): string =>
  `${SCHOOL_GRANT_NAMESPACE}${permission}`;

export const schoolPermissionFrom = (
  grant: unknown,
): { readonly permission: Permission } | { readonly reason: DroppedGrantReason } => {
  if (typeof grant !== 'string' || grant.trim() === '') return { reason: 'malformed' };
  const value = grant.trim();
  if (value.includes('*')) return { reason: 'wildcard' };
  if (!value.startsWith(SCHOOL_GRANT_NAMESPACE)) return { reason: 'not-a-school-grant' };
  const remainder = value.slice(SCHOOL_GRANT_NAMESPACE.length);
  if (!SEGMENTS.test(remainder)) return { reason: 'malformed' };
  if (!DECLARED.has(remainder)) return { reason: 'not-a-declared-permission' };
  if (PLATFORM_PLANE(remainder)) return { reason: 'platform-plane' };
  return { permission: remainder as Permission };
};

/**
 * The School permissions a verified `perms` claim confers. Anything that is not an array of
 * grants confers nothing.
 */
export const schoolPermissionsFrom = (
  perms: unknown,
  onDropped?: (dropped: DroppedGrant) => void,
): Permission[] => {
  if (!Array.isArray(perms)) return [];
  const granted = new Set<Permission>();
  for (const entry of perms) {
    const read = schoolPermissionFrom(entry);
    if ('permission' in read) {
      granted.add(read.permission);
    } else {
      onDropped?.({
        grant: typeof entry === 'string' ? entry : '<not a string>',
        reason: read.reason,
      });
    }
  }
  return [...granted];
};
