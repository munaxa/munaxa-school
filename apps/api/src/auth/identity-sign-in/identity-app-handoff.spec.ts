import { createHash, randomBytes } from 'node:crypto';
import {
  APP_HANDOFF_TTL_MS,
  appReturn,
  handoffKey,
  openHandoff,
  sealHandoff,
} from './identity-app-handoff';

describe('the hand-off to a School mobile app', () => {
  const key = handoffKey('a-refresh-secret-of-some-length');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const now = 1_800_000_000_000;
  const sealed = sealHandoff(key, { refreshToken: 'rt', challenge, mustChangePassword: true }, now);

  it('opens with the verifier, and carries nothing readable', () => {
    expect(openHandoff(key, sealed, verifier, now)).toEqual({
      ok: true,
      refreshToken: 'rt',
      mustChangePassword: true,
    });
    expect(Buffer.from(sealed, 'base64url').toString('latin1')).not.toContain('rt"');
  });

  it('refuses another verifier, a changed hand-off, another key, and an expired one', () => {
    const other = randomBytes(32).toString('base64url');
    expect(openHandoff(key, sealed, other, now)).toEqual({ ok: false, reason: 'VERIFIER' });
    expect(openHandoff(key, sealed, 'short', now)).toEqual({ ok: false, reason: 'VERIFIER' });
    const raw = Buffer.from(sealed, 'base64url');
    raw[raw.length - 1] ^= 1;
    expect(openHandoff(key, raw.toString('base64url'), verifier, now).ok).toBe(false);
    expect(openHandoff(handoffKey('another-secret-entirely'), sealed, verifier, now).ok).toBe(
      false,
    );
    expect(openHandoff(key, sealed, verifier, now + APP_HANDOFF_TTL_MS + 1)).toEqual({
      ok: false,
      reason: 'EXPIRED',
    });
    expect(openHandoff(key, 42, verifier, now)).toEqual({ ok: false, reason: 'MALFORMED' });
  });

  it('returns to the configured address only', () => {
    expect(appReturn('com.munaxa.teacher://signed-in', { error: 'failed' })).toBe(
      'com.munaxa.teacher://signed-in?error=failed',
    );
  });
});
