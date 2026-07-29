'use client';

import { getMe, type Principal } from './auth';

/**
 * Caches the authenticated principal for the browser session so navigating between pages doesn't
 * re-fetch `/auth/me` each time. Cleared on sign-out.
 */
let cached: Promise<Principal> | null = null;

export function loadPrincipal(): Promise<Principal> {
  if (!cached) cached = getMe();
  return cached;
}

export function clearPrincipalCache(): void {
  cached = null;
}
