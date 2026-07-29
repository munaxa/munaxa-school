// e2e runs are always NODE_ENV=test, regardless of the developer's .env: this disables the
// per-IP throttler (rate limiting has its own assertions) and keeps prod-only guards inert.
process.env.NODE_ENV = 'test';
