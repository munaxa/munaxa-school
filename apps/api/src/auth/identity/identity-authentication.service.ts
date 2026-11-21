import { ForbiddenException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { withPlatform } from '../../prisma/tenant.helpers';
import { SubscriptionService } from '../../subscription/subscription.service';
import type { AuthenticatedUser } from '../auth.types';
import { PlatformAccessTokenVerifier, type VerifiedClaims } from './access-token.verifier';
import {
  readPlatformAuthentication,
  type PlatformAuthenticationConfiguration,
  type PlatformAuthenticationSource,
} from './platform-auth.config';
import { schoolPermissionsFrom } from './school-grants';
import {
  IdentitySessionStatus,
  SESSION_STATUS_UNCHECKED,
  type SessionStatus,
} from './session-status';

/** The `fetch` the introspection check sends with. Bound only by tests. */
export const IDENTITY_FETCH = Symbol('IDENTITY_FETCH');

/** The claims School reads from an Identity token, and the whole of what it reads. */
interface IdentityClaims {
  readonly sub: string;
  readonly iss: string;
  readonly tid: string;
  readonly sid: string;
  readonly exp: number;
  readonly perms?: unknown;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

const identityClaimsOf = (claims: VerifiedClaims): IdentityClaims | undefined =>
  isNonEmptyString(claims.sub) &&
  isNonEmptyString(claims.tid) &&
  isNonEmptyString(claims.sid) &&
  isNonEmptyString(claims.iss)
    ? {
        sub: claims.sub,
        iss: claims.iss,
        tid: claims.tid,
        sid: claims.sid,
        exp: claims.exp,
        perms: claims.perms,
      }
    : undefined;

/**
 * Authenticates a request with a Munaxa Identity access token (SC-07), the way Munaxa Work does:
 *
 * 1. **Verify locally** (`PlatformAccessTokenVerifier`): ES256, `kid`, signature, time, issuer,
 *    audience. A token that fails here never leaves the process.
 * 2. **Resolve through a stored binding.** The token's organisation (`iss`, `tid`) must be bound to
 *    a school (`TenantPlatformBinding`), and its subject (`sub`) must be a School account in *that*
 *    school (`User.platformSubject`), not deleted, disabled or suspended. `tid` filters; it never
 *    selects a school by itself, so an organisation bound to nothing resolves nobody.
 * 3. **Ask Identity whether the session still stands** (introspection, cached for at most a few
 *    seconds), so signing out or revoking a session ends School access promptly.
 * 4. **Translate the grants.** Permissions are the token's `school:` grants that School declares
 *    (`school-grants.ts`), never the platform plane. The principal is always school-plane.
 * 5. **The subscription half of sign-in.** An archived school is refused, as at local sign-in.
 *
 * `undefined` means "not authenticated" (401). Nothing about the token reaches a log or an error.
 */
@Injectable()
export class IdentityAuthenticationService {
  private readonly logger = new Logger(IdentityAuthenticationService.name);
  private readonly configuration: PlatformAuthenticationConfiguration | undefined;
  private readonly verifier: PlatformAccessTokenVerifier | undefined;
  private readonly sessions: SessionStatus;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
    @Optional() @Inject(IDENTITY_FETCH) fetchImpl?: typeof fetch,
  ) {
    const source: PlatformAuthenticationSource = {
      NODE_ENV: config.get<string>('NODE_ENV'),
      PLATFORM_AUTH_ISSUER: config.get<string>('PLATFORM_AUTH_ISSUER'),
      PLATFORM_AUTH_AUDIENCE: config.get<string>('PLATFORM_AUTH_AUDIENCE'),
      PLATFORM_AUTH_ALGORITHM: config.get<string>('PLATFORM_AUTH_ALGORITHM'),
      PLATFORM_AUTH_PUBLIC_KEYS: config.get<string>('PLATFORM_AUTH_PUBLIC_KEYS'),
      PLATFORM_AUTH_CLOCK_SKEW_MS: config.get<number>('PLATFORM_AUTH_CLOCK_SKEW_MS'),
      PLATFORM_AUTH_REVOCATION_CHECK: config.get<string>('PLATFORM_AUTH_REVOCATION_CHECK'),
      PLATFORM_AUTH_INTROSPECTION_URL: config.get<string>('PLATFORM_AUTH_INTROSPECTION_URL'),
      PLATFORM_AUTH_REVOCATION_CACHE_MS: config.get<number>('PLATFORM_AUTH_REVOCATION_CACHE_MS'),
      PLATFORM_AUTH_INTROSPECTION_TIMEOUT_MS: config.get<number>(
        'PLATFORM_AUTH_INTROSPECTION_TIMEOUT_MS',
      ),
    };
    const read = readPlatformAuthentication(source);
    // Env validation has already refused `invalid` at boot; this is the same function deciding.
    if (read.kind === 'invalid') throw new Error(read.issues.join('\n'));
    this.configuration = read.kind === 'configured' ? read.configuration : undefined;
    this.verifier =
      this.configuration === undefined
        ? undefined
        : new PlatformAccessTokenVerifier(this.configuration);
    const revocation = this.configuration?.revocation;
    this.sessions =
      revocation === undefined || revocation.kind === 'disabled'
        ? SESSION_STATUS_UNCHECKED
        : new IdentitySessionStatus({
            url: revocation.url,
            cacheMs: revocation.cacheMs,
            timeoutMs: revocation.timeoutMs,
            ...(fetchImpl === undefined ? {} : { fetch: fetchImpl }),
            onUnavailable: (reason) =>
              this.logger.warn(`Identity session check unavailable (${reason}); request refused`),
          });
  }

  /** Whether this deployment verifies Identity access tokens at all. */
  get enabled(): boolean {
    return this.verifier !== undefined;
  }

  /** The configured algorithm, for routing a bearer token to this path. */
  get algorithm(): string | undefined {
    return this.configuration?.algorithm;
  }

  async authenticate(token: string): Promise<AuthenticatedUser | undefined> {
    if (this.verifier === undefined) return undefined;

    let claims: IdentityClaims | undefined;
    try {
      claims = identityClaimsOf(this.verifier.verify(token));
    } catch {
      // Expired and forged are not told apart to the caller, and the token is never quoted.
      return undefined;
    }
    if (claims === undefined) return undefined;

    const account = await this.resolve(claims);
    if (account === undefined) return undefined;

    let active: boolean;
    try {
      active = await this.sessions.isActive(token, {
        sub: claims.sub,
        tid: claims.tid,
        sid: claims.sid,
        exp: claims.exp,
      });
    } catch {
      return undefined;
    }
    if (!active) return undefined;

    const refusal = await this.subscriptions.signInRefusal(account.tenantId);
    if (refusal) throw new ForbiddenException(refusal);

    return {
      userId: account.userId,
      tenantId: account.tenantId,
      isPlatform: false,
      roles: [],
      permissions: schoolPermissionsFrom(claims.perms, (dropped) => {
        // Other products' grants travel in the same token and are expected; only report a grant
        // that was meant for School and conferred nothing.
        if (dropped.reason !== 'not-a-school-grant') {
          this.logger.warn(
            `An Identity grant conferred no School permission: ${dropped.grant} (${dropped.reason})`,
          );
        }
      }),
      mustChangePassword: false,
      authSource: 'identity',
    };
  }

  /** The School account this token's subject is, in the school bound to its organisation. */
  private resolve(
    claims: IdentityClaims,
  ): Promise<{ userId: string; tenantId: string } | undefined> {
    return withPlatform(this.prisma, async (tx) => {
      const binding = await tx.tenantPlatformBinding.findFirst({
        where: { platformIssuer: claims.iss, platformTenantId: claims.tid, deletedAt: null },
        select: { tenantId: true },
      });
      if (!binding) return undefined;
      const user = await tx.user.findFirst({
        where: { tenantId: binding.tenantId, platformSubject: claims.sub, deletedAt: null },
        select: { id: true, tenantId: true, status: true },
      });
      if (!user || user.status === UserStatus.DISABLED || user.status === UserStatus.SUSPENDED) {
        return undefined;
      }
      return { userId: user.id, tenantId: user.tenantId };
    });
  }
}
