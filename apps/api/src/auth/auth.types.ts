import type { Permission } from '@school/domain';

/** The authenticated principal attached to each request after JWT verification. */
export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  isPlatform: boolean;
  // System role keys (RoleKey) plus any custom per-tenant role keys (free text).
  roles: string[];
  permissions: Permission[];
  // True while the account is on a temporary password and must change it before accessing any
  // protected route. Carried in the access token (mcp claim) and enforced by MustChangePasswordGuard.
  mustChangePassword?: boolean;
}

/** Access-token JWT payload. */
export interface AccessTokenPayload {
  sub: string; // userId
  tid: string; // tenantId
  plat: boolean; // platform plane
  roles: string[];
  perms: Permission[];
  mcp?: boolean; // mustChangePassword — forces the password-change gate
}

/** A freshly issued token pair returned to clients. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // access token TTL (seconds)
}
