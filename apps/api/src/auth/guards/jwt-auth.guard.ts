import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TokenService } from '../services/token.service';
import { accessTokenFromCookie } from '../cookies';
import type { AuthenticatedUser } from '../auth.types';

/**
 * Global authentication guard. Verifies the access token — from the Authorization: Bearer header
 * (mobile/API clients) or the httpOnly access cookie (web admin) — and attaches the principal to
 * the request. Routes annotated with @Public() are exempt.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = this.extractToken(request);
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
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (header) {
      const [scheme, value] = header.split(' ');
      if (scheme === 'Bearer' && value) return value;
    }
    // Fall back to the httpOnly cookie (web admin session).
    return accessTokenFromCookie(request);
  }
}
