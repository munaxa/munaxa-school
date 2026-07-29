import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SubscriptionService } from './subscription.service';
import { ALLOW_IN_READ_ONLY_KEY } from './allow-in-read-only.decorator';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Enforces the READ_ONLY subscription state: a school in READ_ONLY (or any suspended/terminal
 * state) can still sign in and READ its data, but every create/update/delete is blocked with a
 * 403 + upgrade prompt. Reads, the platform plane, and routes marked `@AllowInReadOnly()`
 * (upgrade request, password change, logout) always pass.
 *
 * Never hides or deletes data — it only blocks writes, so the school keeps full visibility.
 * Enforcement is centralized via the shared {@link SubscriptionService} (no second resolver).
 */
@Injectable()
export class ReadOnlyStateGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();

    // Only mutating school-plane requests are gated.
    if (SAFE_METHODS.has(request.method)) return true;
    const user = request.user;
    if (!user || user.isPlatform) return true;

    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_IN_READ_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) return true;

    if (await this.subscriptions.canMutate(user.tenantId)) return true;

    throw new ForbiddenException(
      'Your subscription is read-only. You can still view your data — upgrade or contact Munaxa to restore editing.',
    );
  }
}
