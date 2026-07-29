import { Logger, type CallHandler, type ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

/** A fake express response that records the `finish` handler so the test can fire it. */
function fakeResponse(statusCode: number) {
  let finish: (() => void) | undefined;
  return {
    statusCode,
    once: (event: string, cb: () => void) => {
      if (event === 'finish') finish = cb;
    },
    emitFinish: () => finish?.(),
  };
}

function httpContext(req: Record<string, unknown>, res: unknown): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
}

const handler = (): CallHandler => ({ handle: () => of({ ok: true }) });

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    jest.restoreAllMocks();
  });

  it('logs a success summary at log level once the response finishes', async () => {
    const spy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const res = fakeResponse(201);
    const ctx = httpContext(
      {
        method: 'POST',
        url: '/api/v1/x',
        originalUrl: '/api/v1/x',
        path: '/api/v1/x',
        user: { tenantId: 't1', userId: 'u1' },
      },
      res,
    );

    await firstValueFrom(interceptor.intercept(ctx, handler()));
    expect(spy).not.toHaveBeenCalled(); // nothing logged until the response finishes
    res.emitFinish();

    expect(spy).toHaveBeenCalledTimes(1);
    const line = String(spy.mock.calls[0]?.[0] ?? '');
    expect(line).toContain('POST');
    expect(line).toContain('201');
    expect(line).toContain('tenant=t1');
    expect(line).toContain('user=u1');
  });

  it('warns on 4xx, errors on 5xx, and skips health probes', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    const res403 = fakeResponse(403);
    await firstValueFrom(
      interceptor.intercept(
        httpContext({ method: 'GET', url: '/api/v1/y', path: '/api/v1/y' }, res403),
        handler(),
      ),
    );
    res403.emitFinish();
    expect(warn).toHaveBeenCalledTimes(1);

    const res500 = fakeResponse(500);
    await firstValueFrom(
      interceptor.intercept(
        httpContext({ method: 'GET', url: '/api/v1/z', path: '/api/v1/z' }, res500),
        handler(),
      ),
    );
    res500.emitFinish();
    expect(error).toHaveBeenCalledTimes(1);

    // Health probe is skipped entirely (no finish listener registered, nothing logged).
    const resHealth = fakeResponse(200);
    await firstValueFrom(
      interceptor.intercept(
        httpContext({ method: 'GET', url: '/health/ready', path: '/health/ready' }, resHealth),
        handler(),
      ),
    );
    resHealth.emitFinish();
    expect(log).not.toHaveBeenCalled();
  });
});
