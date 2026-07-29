import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { OrganizationService } from './organization.service';
import {
  ASSET_SLOTS,
  type AssetSlot,
  ConfirmAssetDto,
  PresignAssetDto,
  UpdateAcademicDto,
  UpdateAdvancedDto,
  UpdateBrandingDto,
  UpdateCommunicationDto,
  UpdateComplianceDto,
  UpdateContactDto,
  UpdateDocumentsDto,
  UpdateGeneralDto,
  UpdateSocialDto,
} from './organization.dto';

/**
 * Settings → Organization: the single source of truth for school identity, branding, document
 * generation, communication identity, compliance, social presence, and advanced document
 * defaults. Reads need `organization:read`; each section is gated by its own permission so an
 * admin can delegate (e.g. branding) without granting the whole module.
 */
@ApiTags('organization')
@ApiBearerAuth()
@Controller({ path: 'organization', version: '1' })
export class OrganizationController {
  constructor(private readonly service: OrganizationService) {}

  @Get()
  @RequirePermissions(Permission.ORGANIZATION_READ)
  @ApiOperation({ summary: 'Get this tenant’s organization settings (lazily created)' })
  get() {
    return this.service.get();
  }

  @Put('general')
  @RequirePermissions(Permission.ORGANIZATION_UPDATE)
  @ApiOperation({ summary: 'Update general identity information' })
  updateGeneral(@Body() dto: UpdateGeneralDto) {
    return this.service.updateGeneral(dto);
  }

  @Put('contact')
  @RequirePermissions(Permission.ORGANIZATION_UPDATE)
  @ApiOperation({ summary: 'Update contact information' })
  updateContact(@Body() dto: UpdateContactDto) {
    return this.service.updateContact(dto);
  }

  @Put('academic')
  @RequirePermissions(Permission.ORGANIZATION_UPDATE)
  @ApiOperation({ summary: 'Update academic identity' })
  updateAcademic(@Body() dto: UpdateAcademicDto) {
    return this.service.updateAcademic(dto);
  }

  @Put('branding')
  @RequirePermissions(Permission.ORGANIZATION_BRANDING)
  @ApiOperation({ summary: 'Update branding toggles + logo/watermark/stamp/signature config' })
  updateBranding(@Body() dto: UpdateBrandingDto) {
    return this.service.updateBranding(dto);
  }

  @Put('documents')
  @RequirePermissions(Permission.ORGANIZATION_DOCUMENTS)
  @ApiOperation({ summary: 'Update printed-document layout settings' })
  updateDocuments(@Body() dto: UpdateDocumentsDto) {
    return this.service.updateDocuments(dto);
  }

  @Put('communication')
  @RequirePermissions(Permission.ORGANIZATION_COMMUNICATION)
  @ApiOperation({ summary: 'Update communication identity' })
  updateCommunication(@Body() dto: UpdateCommunicationDto) {
    return this.service.updateCommunication(dto);
  }

  @Put('social')
  @RequirePermissions(Permission.ORGANIZATION_UPDATE)
  @ApiOperation({ summary: 'Update social & website links (+ enable toggle)' })
  updateSocial(@Body() dto: UpdateSocialDto) {
    return this.service.updateSocial(dto);
  }

  @Put('compliance')
  @RequirePermissions(Permission.ORGANIZATION_COMPLIANCE)
  @ApiOperation({ summary: 'Update legal & compliance identifiers (+ enable toggle)' })
  updateCompliance(@Body() dto: UpdateComplianceDto) {
    return this.service.updateCompliance(dto);
  }

  @Put('advanced')
  @RequirePermissions(Permission.ORGANIZATION_ADVANCED)
  @ApiOperation({ summary: 'Update advanced document defaults' })
  updateAdvanced(@Body() dto: UpdateAdvancedDto) {
    return this.service.updateAdvanced(dto);
  }

  @Post('assets/presign')
  @HttpCode(200)
  @RequirePermissions(Permission.ORGANIZATION_BRANDING)
  @ApiOperation({ summary: 'Pre-signed URL to upload a branding asset (images only, ≤5 MB)' })
  presignAsset(@Body() dto: PresignAssetDto) {
    return this.service.presignAsset(dto);
  }

  @Post('assets/confirm')
  @HttpCode(200)
  @RequirePermissions(Permission.ORGANIZATION_BRANDING)
  @ApiOperation({ summary: 'Persist an uploaded asset key onto its slot' })
  confirmAsset(@Body() dto: ConfirmAssetDto) {
    return this.service.confirmAsset(dto);
  }

  @Delete('assets/:slot')
  @RequirePermissions(Permission.ORGANIZATION_BRANDING)
  @ApiParam({ name: 'slot', enum: ASSET_SLOTS })
  @ApiOperation({ summary: 'Remove a stored branding asset' })
  removeAsset(@Param('slot') slot: AssetSlot) {
    return this.service.removeAsset(slot);
  }
}
