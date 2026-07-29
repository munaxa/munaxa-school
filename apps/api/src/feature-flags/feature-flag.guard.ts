import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types';
import { FEATURE_KEY } from './require-feature.decorator';
import { FeatureGate } from './feature-gate.service';

/**
 * Enforces a per-tenant feature flag declared via {@link RequireFeature}. Runs as a
 * controller-scoped guard (after the global auth guard, so `request.user` is set). If the
 * flag is not enabled for the tenant, the module is treated as if it does not exist (403).
 */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly gate: FeatureGate,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const key = this.reflector.getAllAndOverride<string>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!key) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    const enabled = await this.gate.isEnabled(user.tenantId, key);
    if (!enabled) {
      throw new ForbiddenException(`Module '${key}' is not enabled for this tenant`);
    }
    return true;
  }
}
