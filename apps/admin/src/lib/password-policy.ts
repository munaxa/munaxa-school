/**
 * Frontend password policy — kept in lock-step with the backend PasswordService.assertStrong and
 * the API DTO PASSWORD_PATTERN. Used by the Force Password Change screen for inline validation so
 * users get immediate feedback; the backend remains the authoritative validator.
 */
export const PASSWORD_MIN_LENGTH = 8;

export interface PasswordRule {
  /** i18n key (under `passwordPolicy`) describing the rule. */
  key: string;
  test: (value: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { key: 'minLength', test: (v) => v.length >= PASSWORD_MIN_LENGTH },
  { key: 'uppercase', test: (v) => /[A-Z]/.test(v) },
  { key: 'lowercase', test: (v) => /[a-z]/.test(v) },
  { key: 'number', test: (v) => /\d/.test(v) },
  { key: 'special', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

/** True when the password satisfies every policy rule. */
export function isPasswordStrong(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}
