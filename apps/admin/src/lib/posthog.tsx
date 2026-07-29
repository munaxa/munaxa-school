'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

/**
 * PostHog product-analytics provider. No-ops when the key is absent (local dev).
 * Keys are public (NEXT_PUBLIC_*) by design; no secrets are embedded.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';
    if (key && typeof window !== 'undefined') {
      posthog.init(key, {
        api_host: host,
        capture_pageview: true,
        person_profiles: 'identified_only',
      });
    }
  }, []);

  return <>{children}</>;
}
