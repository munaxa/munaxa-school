import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { PlanFeature } from '@school/domain';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SubscriptionService } from './subscription.service';
import { PLAN_FEATURE_KEY } from './require-plan-feature.decorator';

/**
 * Enforces `@RequirePlanFeature(...)`: the acting tenant's subscription (or a per-tenant
 * override) must include the capability, otherwise a 403 with an upgrade message is thrown by
 * {@link SubscriptionService.assertFeature}. Platform-plane principals bypass plan gating.
 */
@Injectable()
export class PlanFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<PlanFeature | undefined>(PLAN_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!feature) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user || user.isPlatform) return true; // platform plane is not plan-gated

    await this.subscriptions.assertFeature(user.tenantId, feature);
    return true;
  }
}
