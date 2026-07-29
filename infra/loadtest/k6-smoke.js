/**
 * Munaxa API — k6 smoke / baseline load test (Phase 15).
 *
 * Exercises the public health probe and an authenticated read path under a ramping load, and
 * fails the run if latency or error budgets are breached. This is a *baseline* smoke test, not a
 * stress test — tune VUs/duration for capacity planning.
 *
 * Usage:
 *   BASE_URL=https://api.staging.munaxa.app \
 *   TENANT_SLUG=demo EMAIL=admin@demo.example PASSWORD=... \
 *   k6 run infra/loadtest/k6-smoke.js
 *
 * Install k6: https://k6.io/docs/get-started/installation/
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const API = `${BASE_URL}/api/v1`;
const TENANT_SLUG = __ENV.TENANT_SLUG || 'demo';
const EMAIL = __ENV.EMAIL || 'admin@demo.example';
const PASSWORD = __ENV.PASSWORD || 'Sup3rSecret!';

const errorRate = new Rate('business_errors');

export const options = {
  scenarios: {
    baseline: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 }, // ramp up
        { duration: '1m', target: 20 }, // sustained
        { duration: '20s', target: 0 }, // ramp down
      ],
    },
  },
  thresholds: {
    // 99% of requests under 800ms; <1% HTTP failures; <1% business errors.
    http_req_duration: ['p(95)<500', 'p(99)<800'],
    http_req_failed: ['rate<0.01'],
    business_errors: ['rate<0.01'],
  },
};

export function setup() {
  const res = http.post(
    `${API}/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD, tenantSlug: TENANT_SLUG }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { 'login ok': (r) => r.status === 200 });
  return { token: res.json('accessToken') };
}

export default function (data) {
  // Public liveness probe (no auth) — cheap, should always be fast.
  const live = http.get(`${API}/health/live`);
  check(live, { 'live 200': (r) => r.status === 200 }) || errorRate.add(1);

  // Authenticated read path.
  const headers = { Authorization: `Bearer ${data.token}` };
  const me = http.get(`${API}/auth/me`, { headers });
  check(me, { 'me 200': (r) => r.status === 200 }) || errorRate.add(1);

  sleep(1);
}
