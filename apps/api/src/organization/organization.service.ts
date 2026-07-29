import { BadRequestException, Injectable } from '@nestjs/common';
import type { OrganizationSettings, Prisma } from '@prisma/client';
import { StorageService, type PresignedUpload } from '../common/storage.service';
import { requireTenantId } from '../common/tenant.util';
import { OrganizationRepository } from './organization.repository';
import {
  ASSET_SLOTS,
  type AssetSlot,
  type ConfirmAssetDto,
  type PresignAssetDto,
  type UpdateAcademicDto,
  type UpdateAdvancedDto,
  type UpdateBrandingDto,
  type UpdateCommunicationDto,
  type UpdateComplianceDto,
  type UpdateContactDto,
  type UpdateDocumentsDto,
  type UpdateGeneralDto,
  type UpdateSocialDto,
} from './organization.dto';

/** Maps an upload slot to its asset-key column on OrganizationSettings. */
const SLOT_TO_COLUMN: Record<AssetSlot, keyof OrganizationSettings> = {
  logo: 'logoKey',
  darkLogo: 'darkLogoKey',
  smallLogo: 'smallLogoKey',
  stamp: 'stampKey',
  signature: 'signatureKey',
  banner: 'bannerKey',
  pushIcon: 'pushIconKey',
  notificationImage: 'notificationImageKey',
};

/** The organization settings plus freshly-signed download URLs for each present asset. */
export type OrganizationView = OrganizationSettings & {
  assetUrls: Partial<Record<AssetSlot, string>>;
};

@Injectable()
export class OrganizationService {
  constructor(
    private readonly repo: OrganizationRepository,
    private readonly storage: StorageService,
  ) {}

  /** Read the tenant's organization settings, enriched with signed asset download URLs. */
  async get(): Promise<OrganizationView> {
    return this.withAssetUrls(await this.repo.getOrCreate());
  }

  updateGeneral(dto: UpdateGeneralDto): Promise<OrganizationView> {
    return this.apply('organization.general.updated', this.scalars(dto));
  }

  updateContact(dto: UpdateContactDto): Promise<OrganizationView> {
    return this.apply('organization.contact.updated', this.scalars(dto));
  }

  updateAcademic(dto: UpdateAcademicDto): Promise<OrganizationView> {
    return this.apply('organization.academic.updated', this.scalars(dto));
  }

  updateAdvanced(dto: UpdateAdvancedDto): Promise<OrganizationView> {
    return this.apply('organization.advanced.updated', this.scalars(dto));
  }

  updateCommunication(dto: UpdateCommunicationDto): Promise<OrganizationView> {
    return this.apply('organization.communication.updated', this.scalars(dto));
  }

  async updateBranding(dto: UpdateBrandingDto): Promise<OrganizationView> {
    const current = await this.repo.getOrCreate();
    const { logoVisibility, watermark, ...rest } = dto;
    const changes: Prisma.OrganizationSettingsUpdateInput = this.scalars(rest);
    if (logoVisibility !== undefined) {
      changes.logoVisibility = this.mergeJson(current.logoVisibility, logoVisibility);
    }
    if (watermark !== undefined) {
      changes.watermark = this.mergeJson(current.watermark, watermark);
    }
    return this.apply('organization.branding.updated', changes);
  }

  async updateDocuments(dto: UpdateDocumentsDto): Promise<OrganizationView> {
    const current = await this.repo.getOrCreate();
    const { documents, ...rest } = dto;
    const changes: Prisma.OrganizationSettingsUpdateInput = this.scalars(rest);
    if (documents !== undefined) {
      changes.documents = this.mergeJson(current.documents, documents);
    }
    return this.apply('organization.documents.updated', changes);
  }

  async updateSocial(dto: UpdateSocialDto): Promise<OrganizationView> {
    const current = await this.repo.getOrCreate();
    const { social, ...rest } = dto;
    const changes: Prisma.OrganizationSettingsUpdateInput = this.scalars(rest);
    if (social !== undefined) {
      changes.social = this.mergeJson(current.social, social);
    }
    return this.apply('organization.social.updated', changes);
  }

  updateCompliance(dto: UpdateComplianceDto): Promise<OrganizationView> {
    const { otherGovIds, ...rest } = dto;
    const changes: Prisma.OrganizationSettingsUpdateInput = this.scalars(rest);
    // Government identifiers are a list — replaced wholesale (no partial merge of array entries).
    if (otherGovIds !== undefined) {
      changes.otherGovIds = otherGovIds as unknown as Prisma.InputJsonValue;
    }
    return this.apply('organization.compliance.updated', changes);
  }

  /** Mint a pre-signed upload URL for a branding/communication asset (type + size validated). */
  presignAsset(dto: PresignAssetDto): Promise<PresignedUpload> {
    const key = this.storage.buildKey(requireTenantId(), 'organization', dto.fileName);
    return this.storage.presignImageUpload(key, dto.contentType, dto.size);
  }

  /** Persist the uploaded asset's key on its slot column after validating tenant ownership. */
  async confirmAsset(dto: ConfirmAssetDto): Promise<OrganizationView> {
    this.storage.assertKeyInTenant(dto.fileKey);
    this.storage.assertImageAllowed(dto.contentType, dto.size);
    const column = SLOT_TO_COLUMN[dto.slot];
    return this.apply(`organization.asset.${dto.slot}.updated`, {
      [column]: dto.fileKey,
    });
  }

  /** Clear an asset slot (remove the stored key) — the feature toggle controls visibility. */
  async removeAsset(slot: AssetSlot): Promise<OrganizationView> {
    if (!ASSET_SLOTS.includes(slot)) {
      throw new BadRequestException(`Unknown asset slot: ${slot}`);
    }
    const column = SLOT_TO_COLUMN[slot];
    return this.apply(`organization.asset.${slot}.removed`, {
      [column]: null,
    });
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async apply(
    action: string,
    changes: Prisma.OrganizationSettingsUpdateInput,
  ): Promise<OrganizationView> {
    return this.withAssetUrls(await this.repo.update(action, changes));
  }

  /** Copy only defined scalar properties into a Prisma update input (drops `undefined`). */
  private scalars<T extends object>(dto: T): Prisma.OrganizationSettingsUpdateInput {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dto)) {
      if (v !== undefined) out[k] = v;
    }
    return out;
  }

  /** Shallow-merge a partial object into an existing JSON column value. */
  private mergeJson(existing: Prisma.JsonValue | null, patch: object): Prisma.InputJsonValue {
    const base =
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? (existing as Record<string, unknown>)
        : {};
    const merged: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) merged[k] = v;
    }
    return merged as Prisma.InputJsonValue;
  }

  private async withAssetUrls(settings: OrganizationSettings): Promise<OrganizationView> {
    const assetUrls: Partial<Record<AssetSlot, string>> = {};
    for (const slot of ASSET_SLOTS) {
      const key = settings[SLOT_TO_COLUMN[slot]] as string | null;
      if (key) assetUrls[slot] = await this.storage.presignDownload(key);
    }
    return { ...settings, assetUrls };
  }
}
