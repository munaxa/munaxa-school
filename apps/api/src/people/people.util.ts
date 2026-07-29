import { randomBytes } from 'node:crypto';

/**
 * Generate an opaque, unique student QR identity code. Clients render this string as a QR
 * for scan-based attendance (Phase 7). Format: MNX-XXXXXXXXXXXX (Crockford-ish base32).
 */
export function generateStudentQrCode(): string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const bytes = randomBytes(12);
  let code = '';
  for (const byte of bytes) {
    code += alphabet[byte % alphabet.length];
  }
  return `MNX-${code}`;
}
