import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { StorageService, ALLOWED_UPLOAD_MIME } from './storage.service';
import { TenantContextStore } from '../prisma/tenant-context';

/** Minimal ConfigService stub: unconfigured storage (returns stub URLs, exercises validation). */
function makeService(overrides: Record<string, string> = {}): StorageService {
  const config = {
    get: (key: string) => overrides[key],
  } as unknown as ConfigService;
  return new StorageService(config);
}

describe('StorageService — upload validation (file security)', () => {
  const service = makeService();

  it('accepts allow-listed content types', async () => {
    const key = service.buildKey('tenant-1', 'receipts', 'a.pdf');
    await expect(service.presignUpload(key, 'application/pdf', 1024)).resolves.toMatchObject({
      fileKey: key,
    });
    expect(() => service.assertUploadAllowed('image/png')).not.toThrow();
    expect(() => service.assertUploadAllowed('image/jpeg; charset=binary')).not.toThrow();
  });

  it('rejects active/executable content types (stored-XSS & malware vectors)', () => {
    for (const bad of [
      'text/html',
      'image/svg+xml',
      'application/x-msdownload',
      'application/x-sh',
      'application/javascript',
      'text/javascript',
      '',
    ]) {
      expect(() => service.assertUploadAllowed(bad)).toThrow(BadRequestException);
    }
  });

  it('rejects content types not on the allow-list', () => {
    expect(() => service.assertUploadAllowed('application/zip')).toThrow(BadRequestException);
    expect(ALLOWED_UPLOAD_MIME.has('application/zip')).toBe(false);
  });

  it('rejects oversized uploads at presign time', async () => {
    const key = service.buildKey('tenant-1', 'receipts', 'big.pdf');
    await expect(service.presignUpload(key, 'application/pdf', 51 * 1024 * 1024)).rejects.toThrow(
      BadRequestException,
    );
    expect(() => service.assertUploadAllowed('application/pdf', -1)).toThrow(BadRequestException);
  });

  it('namespaces and sanitizes keys per tenant (no path traversal)', () => {
    const key = service.buildKey('tenant-1', 'documents/student-9', '../../etc/passwd');
    expect(key.startsWith('tenants/tenant-1/documents/student-9/')).toBe(true);
    expect(key).not.toContain('..');
    expect(key).not.toContain('/etc/');
  });

  describe('branding images (Organization module)', () => {
    it('accepts SVG/PNG/JPEG/WEBP for branding (SVG widened vs the document allow-list)', () => {
      for (const ok of ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp']) {
        expect(() => service.assertImageAllowed(ok)).not.toThrow();
      }
    });

    it('rejects non-image and oversized branding uploads', () => {
      expect(() => service.assertImageAllowed('application/pdf')).toThrow(BadRequestException);
      expect(() => service.assertImageAllowed('text/html')).toThrow(BadRequestException);
      expect(() => service.assertImageAllowed('image/png', 6 * 1024 * 1024)).toThrow(
        BadRequestException,
      );
    });

    it('presigns a branding image upload (stub URL when storage unconfigured)', async () => {
      const key = service.buildKey('tenant-1', 'organization', 'logo.svg');
      await expect(service.presignImageUpload(key, 'image/svg+xml', 1024)).resolves.toMatchObject({
        fileKey: key,
      });
    });
  });

  describe('assertKeyInTenant — cross-tenant object reference (BOLA)', () => {
    const run = <T>(tenantId: string, fn: () => T) => TenantContextStore.run({ tenantId }, fn);

    it('accepts a key inside the active tenant namespace', () => {
      const key = service.buildKey('tenant-1', 'receipts', 'r.pdf');
      expect(() => run('tenant-1', () => service.assertKeyInTenant(key))).not.toThrow();
    });

    it("rejects another tenant's key", () => {
      const foreign = service.buildKey('tenant-2', 'receipts', 'r.pdf');
      expect(() => run('tenant-1', () => service.assertKeyInTenant(foreign))).toThrow(
        ForbiddenException,
      );
    });

    it('rejects traversal and unscoped keys', () => {
      for (const bad of ['tenants/tenant-1/../tenant-2/x', 'evil/key', '']) {
        expect(() => run('tenant-1', () => service.assertKeyInTenant(bad))).toThrow(
          ForbiddenException,
        );
      }
    });
  });
});
