import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * School's own sign-in (email or username + password, Firebase exchange, School-issued HS256
 * access tokens and refresh tokens) is the legacy path once Munaxa Identity verifies sign-ins
 * (SC-07). It is kept, behind an explicit switch, so a deployment can move over without a flag day:
 *
 *   SCHOOL_LOCAL_AUTH=enabled   School's own sign-in works, alongside Identity if that is configured
 *   SCHOOL_LOCAL_AUTH=disabled  only Identity access tokens are accepted
 *   unset                       enabled outside production, DISABLED in production
 *
 * Production therefore needs either Identity (`PLATFORM_AUTH_*`) or an explicit
 * `SCHOOL_LOCAL_AUTH=enabled`; env validation refuses to boot with neither.
 */
export type LocalAuthSetting = 'enabled' | 'disabled';

export function localAuthEnabled(env: {
  NODE_ENV?: string | undefined;
  SCHOOL_LOCAL_AUTH?: string | undefined;
}): boolean {
  if (env.SCHOOL_LOCAL_AUTH === 'enabled') return true;
  if (env.SCHOOL_LOCAL_AUTH === 'disabled') return false;
  return env.NODE_ENV !== 'production';
}

/**
 * Answers 404 on School's own sign-in routes when local sign-in is off: the route does not exist
 * for this deployment, and nothing about an account is revealed by asking.
 */
@Injectable()
export class LocalAuthEnabledGuard implements CanActivate {
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    this.enabled = localAuthEnabled({
      NODE_ENV: config.get<string>('NODE_ENV'),
      SCHOOL_LOCAL_AUTH: config.get<string>('SCHOOL_LOCAL_AUTH'),
    });
  }

  canActivate(_context: ExecutionContext): boolean {
    if (!this.enabled) {
      throw new NotFoundException('School sign-in is disabled here; sign in with Munaxa Identity.');
    }
    return true;
  }
}
