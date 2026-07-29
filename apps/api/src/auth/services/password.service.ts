import { Injectable, BadRequestException } from '@nestjs/common';
import {
  createHash,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';
import * as bcrypt from 'bcryptjs';

// Explicit wrapper: util.promisify drops the overload that accepts ScryptOptions.
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

// scrypt parameters (OWASP recommendation: N=2^15, r=8, p=1 minimum for interactive logins).
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
// scrypt needs 128*N*r bytes; give headroom so Node doesn't reject the params.
const SCRYPT_MAXMEM = 128 * SCRYPT_N * SCRYPT_R * 2;

/**
 * Password hashing and policy.
 *
 * New hashes use Node's built-in scrypt (memory-hard KDF, dependency-free) in the format
 * `scrypt:N:r:p:salt(base64):key(base64)`. Legacy bcrypt hashes ($2a$/$2b$, from the
 * pre-hardening era) still VERIFY, and {@link needsRehash} lets the auth flow transparently
 * upgrade them to scrypt on the next successful login.
 */
@Injectable()
export class PasswordService {
  async hash(plain: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const key = await scrypt(plain, salt, KEY_LENGTH, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: SCRYPT_MAXMEM,
    });
    return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString('base64')}:${key.toString('base64')}`;
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    if (hash.startsWith('scrypt:')) {
      const parts = hash.split(':');
      if (parts.length !== 6) return false;
      const n = Number(parts[1]);
      const r = Number(parts[2]);
      const p = Number(parts[3]);
      const salt = Buffer.from(parts[4]!, 'base64');
      const expected = Buffer.from(parts[5]!, 'base64');
      if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
      const key = await scrypt(plain, salt, expected.length, {
        N: n,
        r,
        p,
        maxmem: 128 * n * r * 2,
      });
      return key.length === expected.length && timingSafeEqual(key, expected);
    }
    // Legacy bcrypt hash from before the scrypt migration.
    return bcrypt.compare(plain, hash);
  }

  /** True when the stored hash should be transparently upgraded on the next successful login. */
  needsRehash(hash: string): boolean {
    if (!hash.startsWith('scrypt:')) return true;
    const parts = hash.split(':');
    return Number(parts[1]) < SCRYPT_N;
  }

  /**
   * Generate a cryptographically secure random temporary password that satisfies the policy.
   * Emailed to the user once on a Forgot Password request (they must change it at first login).
   * Never logged. Guarantees at least one upper, lower, digit and special character so the result
   * always passes {@link assertStrong}.
   */
  generateTemporary(): string {
    const pick = (set: string) =>
      set[Math.floor((crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32) * set.length)]!;
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const digits = '23456789';
    // Unambiguous special characters (avoid ones that are easy to misread or get mangled by email).
    const special = '!@#$%*?';
    const all = upper + lower + digits + special;
    const chars = [pick(upper), pick(lower), pick(digits), pick(special)];
    while (chars.length < 14) chars.push(pick(all));
    // Fisher–Yates shuffle so the guaranteed-class characters aren't always in front.
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor((crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32) * (i + 1));
      [chars[i], chars[j]] = [chars[j]!, chars[i]!];
    }
    return chars.join('');
  }

  /**
   * Breach-list check via HIBP's k-anonymity range API: only the first 5 chars of the SHA-1
   * are ever sent, never the password. Enabled with PASSWORD_BREACH_CHECK=1 (recommended in
   * production); FAIL-OPEN on network errors/timeouts so an outage can't block password changes.
   * Throws BadRequestException when the password appears in a known breach.
   */
  async assertNotBreached(password: string): Promise<void> {
    if (process.env.PASSWORD_BREACH_CHECK !== '1') return;
    const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    try {
      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'Add-Padding': 'true' },
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) return; // fail-open
      const body = await res.text();
      const hit = body
        .split('\n')
        .some((line) => line.startsWith(suffix) && Number(line.split(':')[1]) > 0);
      if (hit) {
        throw new BadRequestException(
          'This password has appeared in a known data breach. Choose a different one.',
        );
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      // Network failure/timeout: fail-open by design.
    }
  }

  /**
   * Enforce the password policy: min 8 chars, with an upper-case letter, a lower-case letter, a
   * digit and a special character. This is the single backend source of truth — mirrored on the
   * frontend (see admin lib/password-policy) and by the class-validator pattern on the DTOs.
   * Throws BadRequestException on failure.
   */
  assertStrong(password: string): void {
    const failures: string[] = [];
    if (password.length < PasswordService.MIN_LENGTH) {
      failures.push(`at least ${PasswordService.MIN_LENGTH} characters`);
    }
    if (!/[A-Z]/.test(password)) failures.push('an uppercase letter');
    if (!/[a-z]/.test(password)) failures.push('a lowercase letter');
    if (!/\d/.test(password)) failures.push('a digit');
    if (!/[^A-Za-z0-9]/.test(password)) failures.push('a special character');
    if (failures.length > 0) {
      throw new BadRequestException(`Password must contain ${failures.join(', ')}.`);
    }
  }

  /** Minimum password length (policy: enterprise SaaS baseline). */
  static readonly MIN_LENGTH = 8;
}
