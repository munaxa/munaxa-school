import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { TenantContextStore } from '../prisma/tenant-context';
import type { AuthenticatedUser } from './auth.types';

/**
 * Binds the request-scoped {@link TenantContextStore} from the authenticated principal so the
 * data layer (withTenant/withPlatform) can scope queries. Runs after the auth guard.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      return next.handle();
    }
    return TenantContextStore.run(
      {
        tenantId: user.tenantId,
        isPlatform: user.isPlatform,
        actorUserId: user.userId,
        permissions: user.permissions,
      },
      () => next.handle(),
    );
  }
}
