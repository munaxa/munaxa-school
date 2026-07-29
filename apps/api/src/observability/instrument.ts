import * as Sentry from '@sentry/nestjs';

/**
 * Sentry initialization. MUST be imported before any other module in main.ts so that
 * instrumentation is applied early. No-ops when SENTRY_DSN is not set (e.g. local dev).
 */
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    sendDefaultPii: false,
    // Strip credentials/PII from events before they leave the process: drop auth headers,
    // cookies, and the request body (which may carry passwords or national IDs).
    beforeSend(event) {
      const req = event.request;
      if (req) {
        if (req.headers) {
          delete req.headers.authorization;
          delete req.headers.cookie;
          delete req.headers['x-api-key'];
        }
        delete req.cookies;
        delete req.data;
      }
      return event;
    },
  });
}
