import { Module } from '@nestjs/common';
import { PlatformConsoleService } from './platform-console.service';
import { PlatformConsoleRepository } from './platform-console.repository';
import {
  PlatformCatalogController,
  PlatformDashboardController,
  PlatformSchoolsController,
  PlatformSubscriptionsController,
} from './platform-console.controllers';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { OrganizationsRepository } from './organizations.repository';
import { PlanVersionsController } from './plan-versions.controller';
import { PlanVersionsService } from './plan-versions.service';
import { PlanVersionsRepository } from './plan-versions.repository';

/**
 * Platform Console (super-admin plane): Dashboard, Schools, Subscriptions, Upgrade Requests,
 * Trials, Billing, Coupons, Feature Overrides, Audit, Revenue, System Health, Organizations and
 * Plan Versions. Cross-tenant, gated by platform permissions, fully audited. Depends on the global
 * SubscriptionModule for resolver cache invalidation after changes.
 */
@Module({
  controllers: [
    PlatformDashboardController,
    PlatformCatalogController,
    PlatformSubscriptionsController,
    PlatformSchoolsController,
    OrganizationsController,
    PlanVersionsController,
  ],
  providers: [
    PlatformConsoleService,
    PlatformConsoleRepository,
    OrganizationsService,
    OrganizationsRepository,
    PlanVersionsService,
    PlanVersionsRepository,
  ],
})
export class PlatformConsoleModule {}
