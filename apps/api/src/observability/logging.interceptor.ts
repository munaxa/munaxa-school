import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import type { AuthenticatedUser } from '../auth/auth.types';

/**
 * Structured access logging. Emits one line per request with method, path, status, duration, and
 * the acting tenant/user — never the request body or headers (no PII / secrets). Health checks are
 * skipped to avoid drowning the logs in load-balancer probes.
 *
 * Logging is keyed off the response `finish` event so the **final** status code is read (after the
 * exception filter has run), giving the correct level: 5xx → error, 4xx → warn, else → log. This
 * pairs with Sentry (errors/traces) for full observability; this is the request audit trail.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: AuthenticatedUser }>();
    const res = http.getResponse<Response>();

    if (req.path?.includes('/health/')) return next.handle();

    const startedAt = Date.now();
    res.once('finish', () => {
      const durationMs = Date.now() - startedAt;
      const status = res.statusCode;
      const tenant = req.user?.tenantId ?? '-';
      const user = req.user?.userId ?? 'anon';
      const line = `${req.method} ${req.originalUrl ?? req.url} ${status} ${durationMs}ms tenant=${tenant} user=${user}`;
      if (status >= 500) this.logger.error(line);
      else if (status >= 400) this.logger.warn(line);
      else this.logger.log(line);
    });

    return next.handle();
  }
}
