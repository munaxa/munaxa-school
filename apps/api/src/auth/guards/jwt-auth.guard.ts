import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TokenService } from '../services/token.service';
import { accessTokenFromCookie } from '../cookies';
import type { AuthenticatedUser } from '../auth.types';
import { IdentityAuthenticationService } from '../identity/identity-authentication.service';
import { PlatformAccessTokenVerifier } from '../identity/access-token.verifier';
import { localAuthEnabled } from '../local-auth';

/**
 * Global authentication guard. Routes annotated with @Public() are exempt. Two kinds of access
 * token are accepted, each only on its own path, so neither can be passed off as the other:
 *
 * - **Munaxa Identity** (SC-07), when `PLATFORM_AUTH_*` is configured: a bearer token whose header
 *   names ES256 goes to `IdentityAuthenticationService` and nowhere else. It is verified against
 *   Identity's public keys only; it is never tried as a School token, and a failure is a 401.
 * - **School's own** (legacy), when `SCHOOL_LOCAL_AUTH` allows it: the HS256 token School signs,
 *   from the Authorization header (mobile/API) or the httpOnly access cookie (web admin). HS256
 *   only, so an Identity-shaped token can never verify here either.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly localEnabled: boolean;

  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly identity: IdentityAuthenticationService,
    config: ConfigService,
  ) {
    this.localEnabled = localAuthEnabled({
      NODE_ENV: config.get<string>('NODE_ENV'),
      SCHOOL_LOCAL_AUTH: config.get<string>('SCHOOL_LOCAL_AUTH'),
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const bearer = this.bearerToken(request);

    if (
      bearer !== undefined &&
      this.identity.enabled &&
      PlatformAccessTokenVerifier.headerAlgorithm(bearer) === this.identity.algorithm
    ) {
      const principal = await this.identity.authenticate(bearer);
      if (!principal) throw new UnauthorizedException('Invalid or expired token');
      request.user = principal;
      return true;
    }

    if (!this.localEnabled) {
      throw new UnauthorizedException(
        bearer === undefined ? 'Missing bearer token' : 'Invalid or expired token',
      );
    }

    // Fall back to the httpOnly cookie (web admin session) for School's own token only.
    const token = bearer ?? accessTokenFromCookie(request);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    try {
      const payload = this.tokens.verifyAccessToken(token);
      request.user = {
        userId: payload.sub,
        tenantId: payload.tid,
        isPlatform: payload.plat,
        roles: payload.roles,
        permissions: payload.perms,
        mustChangePassword: payload.mcp === true,
        authSource: 'local',
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private bearerToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (header) {
      const [scheme, value] = header.split(' ');
      if (scheme === 'Bearer' && value) return value;
    }
    return undefined;
  }
}
