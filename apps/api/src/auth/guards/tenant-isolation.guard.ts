import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth.types';

/**
 * Blocks tenant-injection attempts: if a school-plane request explicitly supplies a
 * `tenantId` (in params/query/body) that differs from the principal's tenant, it is rejected.
 * Platform-plane principals are exempt (their cross-tenant access is audited elsewhere).
 *
 * This complements the request-scoped TenantContext + PostgreSQL RLS (defense in depth).
 */
@Injectable()
export class TenantIsolationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user || user.isPlatform) return true;

    const supplied = [
      this.pick(request.params as Record<string, unknown>),
      this.pick(request.query as Record<string, unknown>),
      this.pick(request.body as Record<string, unknown> | undefined),
    ].filter((v): v is string => typeof v === 'string');

    for (const tenantId of supplied) {
      if (tenantId !== user.tenantId) {
        throw new ForbiddenException('Cross-tenant access denied');
      }
    }
    return true;
  }

  private pick(source: Record<string, unknown> | undefined): unknown {
    return source?.['tenantId'];
  }
}
