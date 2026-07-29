/**
 * Client-side input validation & sanitisation for the sign-in form.
 *
 * This is a UX / defence-in-depth layer only — the API is the real authority (it re-validates and
 * enforces auth). The goals here are: strip control/markup characters before anything is stored or
 * sent, cap lengths, and give the user immediate, localised feedback. Validators return i18n keys
 * (not text) so the page renders them through `t()`.
 */

export const LOGIN_LIMITS = {
  identifier: 254,
  password: 128,
  schoolCode: 64,
} as const;

// Control characters (incl. NUL and DEL) never belong in these fields — stripping them is the
// whole point of this sanitiser, so the no-control-regex rule is intentionally disabled here.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/** Email/username handle: drop control + angle-bracket chars, trim, and cap length. */
export function sanitizeIdentifier(value: string): string {
  return value
    .replace(CONTROL_CHARS, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, LOGIN_LIMITS.identifier);
}

/** School code is a tenant slug — force lowercase and keep only [a-z0-9-]. */
export function sanitizeSchoolCode(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, LOGIN_LIMITS.schoolCode);
}

/**
 * Passwords may legitimately contain punctuation (incl. `<`/`>`), so we only strip control
 * characters and cap the length — never trim or rewrite the visible content.
 */
export function sanitizePassword(value: string): string {
  return value.replace(CONTROL_CHARS, '').slice(0, LOGIN_LIMITS.password);
}

// Mirrors the API's loose email check (auth.service.ts `looksLikeEmail`).
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// Non-email handle: username or national id — letters, digits and a few safe separators.
const HANDLE_RE = /^[A-Za-z0-9._+@-]{2,}$/;
// Tenant slug: lowercase alphanumeric with internal hyphens.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export interface LoginFieldErrors {
  identifier?: string;
  password?: string;
  schoolCode?: string;
}

/** Validate the (already sanitised) values. Returns a map of field → i18n error key. */
export function validateLogin(values: {
  identifier: string;
  password: string;
  schoolCode: string;
}): LoginFieldErrors {
  const errors: LoginFieldErrors = {};

  if (!values.identifier) {
    errors.identifier = 'auth.errIdentifierRequired';
  } else if (
    values.identifier.includes('@')
      ? !EMAIL_RE.test(values.identifier)
      : !HANDLE_RE.test(values.identifier)
  ) {
    errors.identifier = 'auth.errIdentifierInvalid';
  }

  if (!values.password) {
    errors.password = 'auth.errPasswordRequired';
  }

  if (values.schoolCode && !SLUG_RE.test(values.schoolCode)) {
    errors.schoolCode = 'auth.errSchoolCode';
  }

  return errors;
}
