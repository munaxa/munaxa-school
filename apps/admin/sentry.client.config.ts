import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_ENV ?? 'development',
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    // Privacy: error-session replays run at 100%, and this Admin handles minors' PII + tokens.
    // Mask all text/inputs and block media so replays/breadcrumbs never capture sensitive data.
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],
    // Defence in depth: strip auth tokens from any captured request/breadcrumb data.
    sendDefaultPii: false,
  });
}
