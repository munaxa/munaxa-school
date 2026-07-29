import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Permission } from '@school/domain';
import { ANY_PERMISSIONS_KEY, PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../auth.types';

/**
 * Enforces route permissions: ALL of those declared via @RequirePermissions, and (if present)
 * at least ONE of those declared via @RequireAnyPermission.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredAny = this.reflector.getAllAndOverride<Permission[]>(ANY_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const hasAll = Boolean(required && required.length > 0);
    const hasAny = Boolean(requiredAny && requiredAny.length > 0);
    if (!hasAll && !hasAny) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }
    const held = new Set(user.permissions);

    if (hasAll) {
      const missing = required.filter((p) => !held.has(p));
      if (missing.length > 0) {
        throw new ForbiddenException(`Missing required permission(s): ${missing.join(', ')}`);
      }
    }
    if (hasAny && !requiredAny.some((p) => held.has(p))) {
      throw new ForbiddenException(
        `Missing required permission(s): one of ${requiredAny.join(', ')}`,
      );
    }
    return true;
  }
}
