/**
 * The two short-lived cookies of signing in with Munaxa Identity. Both `httpOnly`, `Lax` (the
 * callback is a top-level navigation back from Identity, which a `Strict` cookie is withheld
 * from), path `/`, and `__Host-` in production: only this exact host can set them, so a sibling
 * host cannot plant one (login CSRF). Plain HTTP in development cannot carry `__Host-`.
 *
 * - binding: the state, nonce and PKCE verifier between the start and the callback.
 * - link offer: a privileged user's Identity account, waiting for their next password sign-in.
 */
const isProduction = (): boolean => process.env.NODE_ENV === 'production';

export const BINDING_COOKIE = (): string =>
  isProduction() ? '__Host-munaxa_identity' : 'munaxa_identity';
export const LINK_COOKIE = (): string =>
  isProduction() ? '__Host-munaxa_identity_link' : 'munaxa_identity_link';

export const IDENTITY_COOKIE_TTL_MS = 10 * 60 * 1_000;

export const identityCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: 'lax' as const,
  path: '/',
});
