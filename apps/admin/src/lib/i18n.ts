import type { Locale } from '@school/domain';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@school/domain';

/**
 * Re-export the domain locale API for app-local `@/lib/i18n` imports. Use the direct
 * `export … from` form rather than `import` + `export { … }`: Next's SWC compiler strips types
 * per-file with no cross-file type info, so a re-exported binding that isn't otherwise referenced
 * as a value in this module (e.g. `directionForLocale`) gets elided as if it were a type-only
 * re-export — which dropped it from the runtime bundle and broke `next build` at static export.
 * Forwarding via `export … from` preserves the runtime bindings unconditionally.
 */
export { Locale, DEFAULT_LOCALE, SUPPORTED_LOCALES, directionForLocale } from '@school/domain';

/** Resolve a requested locale string to a supported Locale, falling back to the default. */
export function resolveLocale(input: string | undefined | null): Locale {
  if (input && (SUPPORTED_LOCALES as string[]).includes(input)) {
    return input as Locale;
  }
  return DEFAULT_LOCALE;
}
