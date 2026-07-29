import { BadRequestException } from '@nestjs/common';
import type { OrganizationSettings } from '@prisma/client';
import { OrganizationService } from './organization.service';
import type { OrganizationRepository } from './organization.repository';
import type { StorageService } from '../common/storage.service';
import { TenantContextStore } from '../prisma/tenant-context';

const BASE = {
  id: 'org1',
  tenantId: 't1',
  logoEnabled: false,
  logoKey: null,
  stampKey: null,
  signatureKey: null,
  darkLogoKey: null,
  smallLogoKey: null,
  bannerKey: null,
  pushIconKey: null,
  notificationImageKey: null,
  logoVisibility: null,
  watermark: null,
  documents: null,
  social: null,
  otherGovIds: null,
} as unknown as OrganizationSettings;

function setup(current: Partial<OrganizationSettings> = {}) {
  const row = { ...BASE, ...current };
  const getOrCreate = jest.fn<Promise<OrganizationSettings>, []>().mockResolvedValue(row);
  // Echo the changes back merged onto the current row so the service's view is realistic.
  const update = jest
    .fn<Promise<OrganizationSettings>, [string, Record<string, unknown>]>()
    .mockImplementation((_action, changes) => Promise.resolve({ ...row, ...changes }));
  const repo = { getOrCreate, update } as unknown as OrganizationRepository;

  const buildKey = jest.fn(
    (tid: string, prefix: string, name: string) => `tenants/${tid}/${prefix}/x-${name}`,
  );
  const presignImageUpload = jest.fn().mockResolvedValue({ uploadUrl: 'https://up', fileKey: 'k' });
  const presignDownload = jest.fn().mockResolvedValue('https://download');
  const assertKeyInTenant = jest.fn();
  const assertImageAllowed = jest.fn();
  const storage = {
    buildKey,
    presignImageUpload,
    presignDownload,
    assertKeyInTenant,
    assertImageAllowed,
  } as unknown as StorageService;

  return {
    service: new OrganizationService(repo, storage),
    repo,
    getOrCreate,
    update,
    presignImageUpload,
    presignDownload,
    assertKeyInTenant,
    assertImageAllowed,
  };
}

describe('OrganizationService', () => {
  describe('get', () => {
    it('signs a download URL only for slots that have a stored key', async () => {
      const { service, presignDownload } = setup({ logoKey: 'tenants/t1/organization/logo.png' });
      const view = await service.get();
      expect(view.assetUrls.logo).toBe('https://download');
      expect(view.assetUrls.stamp).toBeUndefined();
      expect(presignDownload).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateGeneral', () => {
    it('drops undefined fields and forwards only defined scalars', async () => {
      const { service, update } = setup();
      await service.updateGeneral({ nameEn: 'Munaxa School', nameAr: undefined });
      const [, changes] = update.mock.calls[0]!;
      expect(changes).toEqual({ nameEn: 'Munaxa School' });
      expect('nameAr' in changes).toBe(false);
    });
  });

  describe('updateBranding', () => {
    it('toggles a branding feature independently', async () => {
      const { service, update } = setup();
      const view = await service.updateBranding({ logoEnabled: true });
      expect(view.logoEnabled).toBe(true);
      expect(update.mock.calls[0]![1]).toMatchObject({ logoEnabled: true });
    });

    it('shallow-merges logoVisibility into the existing JSON value', async () => {
      const { service, update } = setup({
        logoVisibility: { reports: true, certificates: false } as never,
      });
      await service.updateBranding({ logoVisibility: { certificates: true } });
      expect(update.mock.calls[0]![1].logoVisibility).toEqual({
        reports: true,
        certificates: true,
      });
    });
  });

  describe('updateCompliance', () => {
    it('replaces the otherGovIds list wholesale', async () => {
      const { service, update } = setup({
        otherGovIds: [{ label: 'old', value: '1' }] as never,
      });
      await service.updateCompliance({ otherGovIds: [{ label: 'new', value: '2' }] });
      expect(update.mock.calls[0]![1].otherGovIds).toEqual([{ label: 'new', value: '2' }]);
    });
  });

  describe('assets', () => {
    it('presigns through the image-only storage path', async () => {
      const { service, presignImageUpload } = setup();
      await TenantContextStore.run({ tenantId: 't1' }, () =>
        service.presignAsset({ slot: 'logo', fileName: 'l.svg', contentType: 'image/svg+xml' }),
      );
      expect(presignImageUpload).toHaveBeenCalled();
    });

    it('asserts tenant ownership + image type before persisting a confirmed key', async () => {
      const { service, assertKeyInTenant, assertImageAllowed, update } = setup();
      await service.confirmAsset({
        slot: 'logo',
        fileKey: 'tenants/t1/organization/x-l.png',
        contentType: 'image/png',
      });
      expect(assertKeyInTenant).toHaveBeenCalledWith('tenants/t1/organization/x-l.png');
      expect(assertImageAllowed).toHaveBeenCalled();
      expect(update.mock.calls[0]![1]).toMatchObject({
        logoKey: 'tenants/t1/organization/x-l.png',
      });
    });

    it('rejects an unknown asset slot on removal', async () => {
      const { service } = setup();
      await expect(service.removeAsset('bogus' as never)).rejects.toThrow(BadRequestException);
    });

    it('clears the slot column on removal', async () => {
      const { service, update } = setup({ stampKey: 'tenants/t1/organization/s.png' });
      await service.removeAsset('stamp');
      expect(update.mock.calls[0]![1]).toMatchObject({ stampKey: null });
    });
  });
});
