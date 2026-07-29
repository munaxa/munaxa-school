import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_DURING_PASSWORD_CHANGE_KEY } from '../decorators/allow-during-password-change.decorator';
import type { AuthenticatedUser } from '../auth.types';

/**
 * Global gate for accounts on a temporary password. When the access token carries
 * mustChangePassword=true (mcp claim), every protected route is blocked with 403 until the user
 * changes their password — EXCEPT routes explicitly whitelisted with @AllowDuringPasswordChange()
 * (change-password, me). @Public() routes (login/refresh/logout/forgot-password) are exempt
 * because they carry no authenticated principal.
 *
 * Runs AFTER JwtAuthGuard (which populates request.user from the token) and before the
 * permission/tenant guards, so a temp-password session can never reach Dashboard, Finance,
 * Attendance, Reports, Settings or any other protected API.
 */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    // No principal (or not flagged) → nothing to gate; auth is enforced by JwtAuthGuard.
    if (!user?.mustChangePassword) return true;

    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_DURING_PASSWORD_CHANGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) return true;

    throw new ForbiddenException({
      message: 'You must change your temporary password before continuing.',
      code: 'PASSWORD_CHANGE_REQUIRED',
    });
  }
}
