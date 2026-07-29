/**
 * Client-side sign-in guard: submit rate-limiting + failed-attempt lockout.
 *
 * This complements — it does NOT replace — the server controls. The API already enforces a per-IP
 * throttle and a per-account lockout (5 failures within a 15-minute window; see
 * apps/api/src/auth/services/auth.service.ts). We mirror those thresholds here so the browser stops
 * hammering the endpoint and gives the user an immediate, honest explanation with a countdown.
 *
 * State is persisted in localStorage so it survives reloads within the lockout window. It is a
 * deterrent, not a security boundary — a determined attacker can clear storage, which is exactly
 * why the authoritative checks live on the server.
 */

const GUARD_KEY = 'munaxa.login.guard';

export const LOGIN_GUARD = {
  /** Failed attempts before a temporary lockout — matches the API. */
  maxFailures: 5,
  /** Lockout duration — matches the API's LOCKOUT_WINDOW_MS. */
  lockMs: 15 * 60 * 1000,
  /** Max submit attempts allowed within the rolling rate window. */
  rateMax: 5,
  /** Rolling window for the submit rate limit. */
  rateWindowMs: 60 * 1000,
} as const;

interface GuardState {
  failures: number;
  lockUntil: number;
  attempts: number[];
}

export interface GuardStatus {
  locked: boolean;
  lockRemainingMs: number;
  rateLimited: boolean;
  rateRemainingMs: number;
  remainingAttempts: number;
}

const EMPTY: GuardState = { failures: 0, lockUntil: 0, attempts: [] };

function read(): GuardState {
  if (typeof localStorage === 'undefined') return { ...EMPTY };
  try {
    const raw = localStorage.getItem(GUARD_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<GuardState>;
    return {
      failures: typeof parsed.failures === 'number' ? parsed.failures : 0,
      lockUntil: typeof parsed.lockUntil === 'number' ? parsed.lockUntil : 0,
      attempts: Array.isArray(parsed.attempts)
        ? parsed.attempts.filter((n) => typeof n === 'number')
        : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

function write(state: GuardState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(GUARD_KEY, JSON.stringify(state));
  } catch {
    /* ignore storage access errors */
  }
}

/** Drop stale attempts and clear an expired lockout (which also resets the failure counter). */
function normalize(state: GuardState, now: number): GuardState {
  const attempts = state.attempts.filter((a) => now - a < LOGIN_GUARD.rateWindowMs);
  if (state.lockUntil && state.lockUntil <= now) {
    return { failures: 0, lockUntil: 0, attempts };
  }
  return { failures: state.failures, lockUntil: state.lockUntil, attempts };
}

function toStatus(state: GuardState, now: number): GuardStatus {
  const locked = state.lockUntil > now;
  const inWindow = state.attempts.filter((a) => now - a < LOGIN_GUARD.rateWindowMs);
  const rateLimited = inWindow.length >= LOGIN_GUARD.rateMax;
  const oldest = inWindow.length > 0 ? Math.min(...inWindow) : now;
  return {
    locked,
    lockRemainingMs: locked ? state.lockUntil - now : 0,
    rateLimited,
    rateRemainingMs: rateLimited ? Math.max(0, LOGIN_GUARD.rateWindowMs - (now - oldest)) : 0,
    remainingAttempts: Math.max(0, LOGIN_GUARD.maxFailures - state.failures),
  };
}

/** Current guard status (also persists any pruning of expired state). */
export function guardStatus(now: number = Date.now()): GuardStatus {
  const state = normalize(read(), now);
  write(state);
  return toStatus(state, now);
}

/** Record a submit attempt against the rolling rate window. */
export function recordAttempt(now: number = Date.now()): GuardStatus {
  const state = normalize(read(), now);
  state.attempts = [...state.attempts, now];
  write(state);
  return toStatus(state, now);
}

/** Record a failed sign-in; trips the lockout once the failure threshold is reached. */
export function recordFailure(now: number = Date.now()): GuardStatus {
  const state = normalize(read(), now);
  state.failures += 1;
  if (state.failures >= LOGIN_GUARD.maxFailures) {
    state.lockUntil = now + LOGIN_GUARD.lockMs;
  }
  write(state);
  return toStatus(state, now);
}

/** Clear all guard state after a successful sign-in. */
export function recordSuccess(): void {
  write({ ...EMPTY });
}

/** Format a remaining duration as `m:ss` (or `0:ss` under a minute) for display. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
