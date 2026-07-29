import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes with scrypt and verifies a password', async () => {
    const hash = await service.hash('Sup3rSecret!');
    expect(hash).not.toBe('Sup3rSecret!');
    expect(hash.startsWith('scrypt:')).toBe(true);
    expect(await service.verify('Sup3rSecret!', hash)).toBe(true);
    expect(await service.verify('wrong', hash)).toBe(false);
  });

  it('produces unique salts per hash', async () => {
    const a = await service.hash('Sup3rSecret!');
    const b = await service.hash('Sup3rSecret!');
    expect(a).not.toBe(b);
  });

  it('still verifies legacy bcrypt hashes and flags them for rehash', async () => {
    const legacy = await bcrypt.hash('Sup3rSecret!', 10);
    expect(await service.verify('Sup3rSecret!', legacy)).toBe(true);
    expect(await service.verify('wrong', legacy)).toBe(false);
    expect(service.needsRehash(legacy)).toBe(true);
  });

  it('does not flag a fresh scrypt hash for rehash', async () => {
    const hash = await service.hash('Sup3rSecret!');
    expect(service.needsRehash(hash)).toBe(false);
  });

  it('rejects malformed scrypt hashes without throwing', async () => {
    expect(await service.verify('Sup3rSecret!', 'scrypt:not:a:valid')).toBe(false);
  });

  it('generates policy-compliant temporary passwords (incl. a special character)', () => {
    for (let i = 0; i < 50; i++) {
      const temp = service.generateTemporary();
      expect(() => service.assertStrong(temp)).not.toThrow();
      // The generator must guarantee one of every required character class.
      expect(/[A-Z]/.test(temp)).toBe(true);
      expect(/[a-z]/.test(temp)).toBe(true);
      expect(/\d/.test(temp)).toBe(true);
      expect(/[^A-Za-z0-9]/.test(temp)).toBe(true);
    }
  });

  it('generates unique temporary passwords', () => {
    const a = service.generateTemporary();
    const b = service.generateTemporary();
    expect(a).not.toBe(b);
  });

  it('accepts a strong password', () => {
    expect(() => service.assertStrong('Sup3rSecret!')).not.toThrow();
  });

  it.each([
    'Shrt1A!', // too short (7 chars)
    'alllowercase1!', // no uppercase
    'ALLUPPERCASE1!', // no lowercase
    'NoDigitsHere!', // no digit
    'NoSpecial123', // no special character
  ])('rejects weak password %s', (weak) => {
    expect(() => service.assertStrong(weak)).toThrow(BadRequestException);
  });

  describe('assertNotBreached (HIBP k-anonymity)', () => {
    const realFetch = global.fetch;

    afterEach(() => {
      global.fetch = realFetch;
      delete process.env.PASSWORD_BREACH_CHECK;
    });

    it('is a no-op when the check is disabled', async () => {
      const spy = jest.fn();
      global.fetch = spy;
      await expect(service.assertNotBreached('Sup3rSecret!')).resolves.toBeUndefined();
      expect(spy).not.toHaveBeenCalled();
    });

    it('rejects a breached password (suffix found in the range response)', async () => {
      process.env.PASSWORD_BREACH_CHECK = '1';
      // SHA-1('Password123!') = 49EFEF5F70D47ADC2DB2EB397FBEF5F7BC560E29 → prefix 49EFE, suffix the rest.
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('F5F70D47ADC2DB2EB397FBEF5F7BC560E29:1234\r\nOTHER:0'),
      });
      await expect(service.assertNotBreached('Password123!')).rejects.toThrow(/data breach/);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.pwnedpasswords.com/range/49EFE',
        expect.anything(),
      );
    });

    it('accepts a password whose suffix is absent', async () => {
      process.env.PASSWORD_BREACH_CHECK = '1';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('DEADBEEF:42'),
      });
      await expect(service.assertNotBreached('Sup3rSecret!')).resolves.toBeUndefined();
    });

    it('fails open on network errors', async () => {
      process.env.PASSWORD_BREACH_CHECK = '1';
      global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
      await expect(service.assertNotBreached('Sup3rSecret!')).resolves.toBeUndefined();
    });
  });
});
