import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { StorageService, ALLOWED_UPLOAD_MIME } from './storage.service';
import type { CommitOutcome, StorageLedgerRepository } from './storage-ledger.repository';
import type { SubscriptionService } from '../subscription/subscription.service';
import type { DomainEvents } from '../events/domain-events';
import { UNLIMITED, type Capacity } from '../subscription/capacity';
import { TenantContextStore } from '../prisma/tenant-context';

/** A ledger that records what it was asked, and answers `commit` with `outcome`. */
function fakeLedger(outcome: CommitOutcome = { kind: 'stored', total: 0n }) {
  return {
    reserve: jest.fn().mockResolvedValue(0n),
    commit: jest.fn().mockResolvedValue(outcome),
    release: jest.fn().mockResolvedValue(0n),
    settle: jest.fn().mockResolvedValue(undefined),
    expiredReservations: jest.fn().mockResolvedValue([]),
    reservedSize: jest.fn().mockResolvedValue(1024n),
    reconcile: jest.fn(),
  };
}

/** Minimal ConfigService stub: unconfigured storage (returns stub URLs, exercises validation). */
function makeService(
  overrides: Record<string, string> = {},
  ledger = fakeLedger(),
  capacity: Capacity = UNLIMITED,
) {
  const config = {
    get: (key: string) => overrides[key],
  } as unknown as ConfigService;
  const subscriptions = { capacity: jest.fn().mockResolvedValue(capacity) };
  const events = { emit: jest.fn() };
  const service = new StorageService(
    config,
    ledger as unknown as StorageLedgerRepository,
    subscriptions as unknown as SubscriptionService,
    events as unknown as DomainEvents,
  );
  return Object.assign(service, { fakes: { ledger, events } });
}

const inTenant = <T>(fn: () => T) => TenantContextStore.run({ tenantId: 'tenant-1' }, fn);

describe('StorageService — upload validation (file security)', () => {
  const service = makeService();

  it('accepts allow-listed content types', async () => {
    const key = service.buildKey('tenant-1', 'receipts', 'a.pdf');
    await expect(
      inTenant(() => service.presignUpload(key, 'application/pdf', 1024)),
    ).resolves.toMatchObject({ fileKey: key });
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
      await expect(
        inTenant(() => service.presignImageUpload(key, 'image/svg+xml', 1024)),
      ).resolves.toMatchObject({ fileKey: key });
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

  describe('the storage limit (storage_gb)', () => {
    const key = 'tenants/tenant-1/homework/h/0-a.pdf';

    it('reserves the declared size, or the per-upload ceiling when none is declared', async () => {
      const svc = makeService();
      await inTenant(() => svc.presignUpload(key, 'application/pdf', 4096));
      await inTenant(() => svc.presignUpload(key, 'application/pdf'));
      await inTenant(() => svc.presignImageUpload(key, 'image/png'));
      expect(svc.fakes.ledger.reserve.mock.calls.map((call) => call[1])).toEqual([
        4096n,
        BigInt(50 * 1024 * 1024),
        BigInt(5 * 1024 * 1024),
      ]);
    });

    it('settles expired reservations before reserving more', async () => {
      const svc = makeService();
      svc.fakes.ledger.expiredReservations.mockResolvedValue([{ key: 'tenants/tenant-1/x' }]);
      await inTenant(() => svc.presignUpload(key, 'application/pdf', 1));
      // No bucket here, so nothing arrived: the reservation is released.
      expect(svc.fakes.ledger.settle).toHaveBeenCalledWith('tenants/tenant-1/x', null);
      expect(svc.fakes.ledger.settle.mock.invocationCallOrder[0]).toBeLessThan(
        svc.fakes.ledger.reserve.mock.invocationCallOrder[0]!,
      );
    });

    it('records a confirmed upload and reports the new total in whole GB, rounded up', async () => {
      const svc = makeService({}, fakeLedger({ kind: 'stored', total: 3n * 1024n ** 3n }));
      await inTenant(() => svc.commitUpload(key));
      expect(svc.fakes.ledger.commit).toHaveBeenCalledWith(key, 1024n, UNLIMITED);
      expect(svc.fakes.events.emit).toHaveBeenCalledWith({
        type: 'StorageChanged',
        tenantId: 'tenant-1',
        gigabytes: 3,
      });
      const partial = makeService({}, fakeLedger({ kind: 'stored', total: 3n * 1024n ** 3n + 1n }));
      await inTenant(() => partial.commitUpload(key));
      expect(partial.fakes.events.emit).toHaveBeenCalledWith(
        expect.objectContaining({ gigabytes: 4 }),
      );
    });

    it('measures a confirmed upload by what the bucket holds, not what the client said', async () => {
      const svc = makeService({ AWS_S3_BUCKET: 'b', AWS_ACCESS_KEY_ID: 'k' });
      const head = jest
        .spyOn(
          svc as unknown as { objectSize: (k: string) => Promise<bigint | null> },
          'objectSize',
        )
        .mockResolvedValue(7_000_000n);
      await inTenant(() => svc.commitUpload(key));
      expect(head).toHaveBeenCalledWith(key);
      expect(svc.fakes.ledger.commit).toHaveBeenCalledWith(key, 7_000_000n, UNLIMITED);
      expect(svc.fakes.ledger.reservedSize).not.toHaveBeenCalled();
    });

    it('refuses to confirm an upload that never arrived', async () => {
      const svc = makeService({ AWS_S3_BUCKET: 'b', AWS_ACCESS_KEY_ID: 'k' });
      jest
        .spyOn(
          svc as unknown as { objectSize: (k: string) => Promise<bigint | null> },
          'objectSize',
        )
        .mockResolvedValue(null);
      await expect(inTenant(() => svc.commitUpload(key))).rejects.toThrow(BadRequestException);
      expect(svc.fakes.ledger.commit).not.toHaveBeenCalled();
    });

    it('deletes an upload that does not fit, and refuses with the plan message', async () => {
      const refusal = new ForbiddenException('You have reached the storage (GB) limit (1).');
      const svc = makeService(
        { AWS_S3_BUCKET: 'b', AWS_ACCESS_KEY_ID: 'k' },
        fakeLedger({ kind: 'refused', total: 10n }),
        { limit: 1, refusal },
      );
      jest
        .spyOn(
          svc as unknown as { objectSize: (k: string) => Promise<bigint | null> },
          'objectSize',
        )
        .mockResolvedValue(2n * 1024n ** 3n);
      const removed = jest
        .spyOn(
          svc as unknown as { removeFromBucket: (k: string) => Promise<void> },
          'removeFromBucket',
        )
        .mockResolvedValue(undefined);
      await expect(inTenant(() => svc.commitUpload(key))).rejects.toBe(refusal);
      expect(removed).toHaveBeenCalledWith(key);
    });

    it('deletes an upload confirmed after the subscription stopped allowing growth', async () => {
      const svc = makeService({ AWS_S3_BUCKET: 'b', AWS_ACCESS_KEY_ID: 'k' });
      jest
        .spyOn(
          svc as unknown as { objectSize: (k: string) => Promise<bigint | null> },
          'objectSize',
        )
        .mockResolvedValue(10n);
      const removed = jest
        .spyOn(
          svc as unknown as { removeFromBucket: (k: string) => Promise<void> },
          'removeFromBucket',
        )
        .mockResolvedValue(undefined);
      const refusal = new ForbiddenException('does not allow adding more');
      (
        svc as unknown as { subscriptions: { capacity: jest.Mock } }
      ).subscriptions.capacity.mockRejectedValue(refusal);
      await expect(inTenant(() => svc.commitUpload(key))).rejects.toBe(refusal);
      expect(removed).toHaveBeenCalledWith(key);
      expect(svc.fakes.ledger.release).toHaveBeenCalledWith(key);
      expect(svc.fakes.ledger.commit).not.toHaveBeenCalled();
    });

    it("refuses to confirm another school's key before measuring anything", async () => {
      const svc = makeService();
      await expect(
        inTenant(() => svc.commitUpload('tenants/tenant-2/homework/x.pdf')),
      ).rejects.toThrow(ForbiddenException);
      expect(svc.fakes.ledger.reservedSize).not.toHaveBeenCalled();
    });

    it('releases the bytes of a deleted object', async () => {
      const svc = makeService();
      await inTenant(() => svc.deleteObject(key));
      expect(svc.fakes.ledger.release).toHaveBeenCalledWith(key);
      expect(svc.fakes.events.emit).toHaveBeenCalled();
    });
  });
});

describe('StorageService — credentials and production', () => {
  const key = 'tenants/tenant-1/receipts/abc-a.pdf';

  it('is configured by the ECS task role, without an access key', () => {
    const svc = makeService({
      AWS_S3_BUCKET: 'b',
      AWS_CONTAINER_CREDENTIALS_RELATIVE_URI: '/v2/credentials/x',
    });
    expect(svc.configured).toBe(true);
  });

  it('is not configured by a bucket alone', () => {
    expect(makeService({ AWS_S3_BUCKET: 'b' }).configured).toBe(false);
  });

  it('refuses uploads in production rather than issue a stub URL', async () => {
    const svc = makeService({ NODE_ENV: 'production' });
    await expect(inTenant(() => svc.presignUpload(key, 'application/pdf', 1024))).rejects.toThrow(
      ServiceUnavailableException,
    );
    await expect(inTenant(() => svc.presignImageUpload(key, 'image/png', 1024))).rejects.toThrow(
      ServiceUnavailableException,
    );
    await expect(inTenant(() => svc.commitUpload(key))).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(svc.fakes.ledger.reserve).not.toHaveBeenCalled();
    expect(svc.fakes.ledger.commit).not.toHaveBeenCalled();
  });
});

describe('StorageService — presigned uploads a browser can send', () => {
  const saved = { ...process.env };
  beforeAll(() => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIDEXAMPLE';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret-for-signing-only';
  });
  afterAll(() => {
    process.env = saved;
  });

  it('signs no header the clients do not send (only host, content-type, content-length)', async () => {
    const svc = makeService({ AWS_S3_BUCKET: 'b', AWS_ACCESS_KEY_ID: 'AKIDEXAMPLE' });
    const key = svc.buildKey('tenant-1', 'receipts', 'a.pdf');
    for (const { uploadUrl } of [
      await inTenant(() => svc.presignUpload(key, 'application/pdf', 1024)),
      await inTenant(() => svc.presignImageUpload(key, 'image/png', 1024)),
    ]) {
      const signed = new URL(uploadUrl).searchParams.get('X-Amz-SignedHeaders')!.split(';');
      expect(signed).not.toContain('x-amz-server-side-encryption');
      for (const header of signed) {
        expect(['host', 'content-type', 'content-length']).toContain(header);
      }
    }
  });
});
