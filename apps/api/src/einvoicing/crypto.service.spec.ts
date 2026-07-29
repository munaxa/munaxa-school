import { randomBytes } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

describe('CryptoService (AES-256-GCM secrets at rest)', () => {
  const key = randomBytes(32).toString('base64');
  const config = { get: (k: string) => (k === 'EINVOICE_MASTER_KEY' ? key : undefined) };
  const crypto = new CryptoService(config as unknown as ConfigService);

  it('round-trips a secret (including Arabic)', () => {
    for (const secret of ['super-secret-key-123', 'سر-عربي-١٢٣', '']) {
      expect(crypto.decrypt(crypto.encrypt(secret))).toBe(secret);
    }
  });

  it('uses a fresh IV per encryption (no deterministic ciphertexts)', () => {
    expect(crypto.encrypt('same')).not.toBe(crypto.encrypt('same'));
  });

  it('detects tampering (GCM auth tag)', () => {
    const ct = crypto.encrypt('secret');
    const parts = ct.split(':');
    const data = Buffer.from(parts[3]!, 'base64');
    data[0] = data[0]! ^ 0xff;
    parts[3] = data.toString('base64');
    expect(() => crypto.decrypt(parts.join(':'))).toThrow();
  });

  it('rejects unknown formats and missing/short keys', () => {
    expect(() => crypto.decrypt('v9:a:b:c')).toThrow('Unrecognised');
    const noKey = new CryptoService({ get: () => undefined } as unknown as ConfigService);
    expect(() => noKey.encrypt('x')).toThrow('EINVOICE_MASTER_KEY');
    const shortKey = new CryptoService({
      get: () => Buffer.from('short').toString('base64'),
    } as unknown as ConfigService);
    expect(() => shortKey.encrypt('x')).toThrow('32 bytes');
  });
});
