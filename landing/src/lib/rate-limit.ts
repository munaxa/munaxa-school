/**
 * Minimal in-memory sliding-window rate limiter. Sufficient for a single-instance deployment;
 * swap the store for Redis/KV if the site scales horizontally. Fails open (allows the request)
 * only never — on any doubt it counts the hit.
 */

type Bucket = number[]; // timestamps (ms) of recent hits within the window

const store = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  const hits = (store.get(key) ?? []).filter((t) => t > cutoff);

  if (hits.length >= limit) {
    const oldest = hits[0] ?? now;
    store.set(key, hits);
    return { allowed: false, remaining: 0, resetAt: oldest + windowMs };
  }

  hits.push(now);
  store.set(key, hits);

  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (store.size > 5000) {
    for (const [k, v] of store) {
      if (v.every((t) => t <= cutoff)) store.delete(k);
    }
  }

  return { allowed: true, remaining: limit - hits.length, resetAt: now + windowMs };
}
