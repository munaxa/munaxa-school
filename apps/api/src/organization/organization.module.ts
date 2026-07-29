import { Module } from '@nestjs/common';
import { StorageService } from '../common/storage.service';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { OrganizationRepository } from './organization.repository';

/**
 * Settings → Organization: the tenant's single source of truth for school identity, branding,
 * document generation, communication identity, compliance, social presence, and advanced
 * document defaults. Tenant-isolated (RLS), audited, and RBAC-gated per section. Exports the
 * service so document/report generators can resolve branding + toggles at render time.
 */
@Module({
  controllers: [OrganizationController],
  providers: [OrganizationService, OrganizationRepository, StorageService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
