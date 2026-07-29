import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * AES-256-GCM encryption for integration secrets at rest (e.g. the JoFotara Secret-Key).
 * Ciphertext format `v1:<iv b64>:<tag b64>:<data b64>` — the version prefix allows key
 * rotation by introducing `v2:` with a new master key while still decrypting old rows.
 *
 * The master key comes from the secrets manager via `EINVOICE_MASTER_KEY` (32 bytes,
 * base64). It is only required once a tenant actually enables e-invoicing.
 */
@Injectable()
export class CryptoService {
  constructor(private readonly config: ConfigService) {}

  private key(): Buffer {
    const raw = this.config.get<string>('EINVOICE_MASTER_KEY');
    if (!raw) {
      throw new Error('EINVOICE_MASTER_KEY is not configured (32 bytes, base64)');
    }
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new Error('EINVOICE_MASTER_KEY must decode to exactly 32 bytes');
    }
    return key;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${data.toString('base64')}`;
  }

  decrypt(ciphertext: string): string {
    const [version, ivB64, tagB64, dataB64] = ciphertext.split(':');
    if (version !== 'v1' || !ivB64 || !tagB64 || dataB64 === undefined) {
      throw new Error('Unrecognised ciphertext format');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
