import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ACCESS_COOKIE, CSRF_COOKIE, CSRF_HEADER } from '../cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit CSRF guard for the cookie (web) session. It only applies to mutating requests that
 * authenticate via the httpOnly access cookie — Bearer (mobile/API) clients can't be CSRF'd and are
 * skipped, as are @Public routes (which establish the session before a CSRF token exists). The
 * guard requires the X-CSRF-Token header to equal the readable munaxa_csrf cookie.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;

    const cookies = (req.cookies as Record<string, string> | undefined) ?? {};
    // Only cookie-authenticated requests are subject to CSRF; Bearer requests have no ambient cookie.
    if (!cookies[ACCESS_COOKIE]) return true;

    const headerToken = req.headers[CSRF_HEADER];
    const cookieToken = cookies[CSRF_COOKIE];
    const provided = Array.isArray(headerToken) ? headerToken[0] : headerToken;
    if (!provided || !cookieToken || provided !== cookieToken) {
      throw new ForbiddenException('Invalid or missing CSRF token');
    }
    return true;
  }
}
