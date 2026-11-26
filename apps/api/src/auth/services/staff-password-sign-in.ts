/**
 * Whether staff may sign in with a School password (STAFF_PASSWORD_SIGN_IN). `enabled`: everyone
 * may. `disabled`: only parents and students; staff sign in with Munaxa. `emergency`: as disabled,
 * plus school and platform administrators, for when Identity cannot be reached. Production
 * defaults to `disabled`; development and tests to `enabled`.
 */
export type StaffPasswordSignIn = 'enabled' | 'disabled' | 'emergency';

export const staffPasswordSignIn = (
  value: string | undefined,
  nodeEnv = process.env.NODE_ENV,
): StaffPasswordSignIn =>
  value === 'enabled' || value === 'disabled' || value === 'emergency'
    ? value
    : nodeEnv === 'production'
      ? 'disabled'
      : 'enabled';
