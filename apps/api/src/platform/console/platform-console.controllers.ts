import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { PlatformConsoleService } from './platform-console.service';
import {
  AuditQueryDto,
  ChangeSubscriptionDto,
  CreateCouponDto,
  DecideUpgradeRequestDto,
  EndTrialDto,
  ExtendTrialDto,
  SetFeatureOverrideDto,
  SetPlanFeatureDto,
  SetSubscriptionStatusDto,
  StartTrialDto,
  UpsertBillingProfileDto,
} from './platform-console.dto';

/**
 * Platform Console — Dashboard, Revenue, System Health, Audit Log.
 * Munaxa-employee plane only; every route is gated by a platform permission and every
 * action is audited in the repository layer.
 */
@ApiTags('platform-console')
@ApiBearerAuth()
@Controller({ path: 'platform/console', version: '1' })
export class PlatformDashboardController {
  constructor(private readonly service: PlatformConsoleService) {}

  @Get('dashboard')
  @RequirePermissions(Permission.PLATFORM_DASHBOARD_READ)
  @ApiOperation({ summary: 'Operational dashboard rollups' })
  dashboard() {
    return this.service.dashboard();
  }

  @Get('revenue')
  @RequirePermissions(Permission.PLATFORM_REVENUE_READ)
  @ApiOperation({ summary: 'MRR / ARR revenue overview' })
  revenue() {
    return this.service.revenue();
  }

  @Get('system-health')
  @RequirePermissions(Permission.PLATFORM_SYSTEM_HEALTH_READ)
  @ApiOperation({ summary: 'Platform system health snapshot' })
  systemHealth() {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      node: process.version,
    };
  }

  @Get('audit')
  @RequirePermissions(Permission.PLATFORM_AUDIT_READ)
  @ApiOperation({ summary: 'Cross-tenant platform audit log' })
  audit(@Query() query: AuditQueryDto) {
    return this.service.listAudit(query);
  }
}

/** Platform Console — Plans & Coupons (global catalog). */
@ApiTags('platform-console')
@ApiBearerAuth()
@Controller({ path: 'platform/console', version: '1' })
export class PlatformCatalogController {
  constructor(private readonly service: PlatformConsoleService) {}

  @Get('plans')
  @RequirePermissions(Permission.PLATFORM_SUBSCRIPTION_READ)
  @ApiOperation({ summary: 'List subscription plans' })
  plans() {
    return this.service.listPlans();
  }

  @Post('plans/:planId/features')
  @RequirePermissions(Permission.PLATFORM_PLAN_MANAGE)
  @ApiOperation({ summary: 'Enable/disable a capability on a plan' })
  setPlanFeature(@Param('planId') planId: string, @Body() dto: SetPlanFeatureDto) {
    return this.service.setPlanFeature(planId, dto.key, dto.enabled, dto.limit ?? null);
  }

  @Get('coupons')
  @RequirePermissions(Permission.PLATFORM_COUPON_MANAGE)
  @ApiOperation({ summary: 'List coupons' })
  coupons() {
    return this.service.listCoupons();
  }

  @Post('coupons')
  @RequirePermissions(Permission.PLATFORM_COUPON_MANAGE)
  @ApiOperation({ summary: 'Create a coupon' })
  createCoupon(@Body() dto: CreateCouponDto) {
    return this.service.createCoupon(dto);
  }

  @Patch('coupons/:id')
  @RequirePermissions(Permission.PLATFORM_COUPON_MANAGE)
  @ApiOperation({ summary: 'Update a coupon' })
  updateCoupon(@Param('id') id: string, @Body() dto: Partial<CreateCouponDto>) {
    return this.service.updateCoupon(id, dto);
  }
}

/** Platform Console — Subscriptions & Upgrade Requests. */
@ApiTags('platform-console')
@ApiBearerAuth()
@Controller({ path: 'platform/console', version: '1' })
export class PlatformSubscriptionsController {
  constructor(private readonly service: PlatformConsoleService) {}

  @Get('subscriptions')
  @RequirePermissions(Permission.PLATFORM_SUBSCRIPTION_READ)
  @ApiOperation({ summary: 'List every school subscription' })
  subscriptions() {
    return this.service.listSubscriptions();
  }

  @Get('upgrade-requests')
  @RequirePermissions(Permission.PLATFORM_UPGRADE_REVIEW)
  @ApiOperation({ summary: 'List upgrade requests (optionally filter by status)' })
  upgradeRequests(@Query('status') status?: string) {
    return this.service.listUpgradeRequests(status);
  }

  @Post('upgrade-requests/:id/decision')
  @RequirePermissions(Permission.PLATFORM_UPGRADE_REVIEW)
  @ApiOperation({ summary: 'Approve or reject an upgrade request (approval applies immediately)' })
  decide(@Param('id') id: string, @Body() dto: DecideUpgradeRequestDto) {
    return this.service.decideUpgradeRequest(id, dto);
  }
}

/**
 * Platform Console — a single School (tenant): overview, subscription lifecycle, trials,
 * billing, and per-tenant feature overrides.
 */
@ApiTags('platform-console')
@ApiBearerAuth()
@Controller({ path: 'platform/console/schools', version: '1' })
export class PlatformSchoolsController {
  constructor(private readonly service: PlatformConsoleService) {}

  @Get()
  @RequirePermissions(Permission.PLATFORM_SCHOOL_READ)
  @ApiOperation({ summary: 'List all customer schools' })
  list() {
    return this.service.listSchools();
  }

  @Get(':tenantId')
  @RequirePermissions(Permission.PLATFORM_SCHOOL_READ)
  @ApiOperation({
    summary: 'Full school detail (subscription, usage, billing, overrides, activity)',
  })
  get(@Param('tenantId') tenantId: string) {
    return this.service.getSchool(tenantId);
  }

  @Get(':tenantId/timeline')
  @RequirePermissions(Permission.PLATFORM_SCHOOL_READ)
  @ApiOperation({ summary: 'Chronological activity timeline for a school (from the audit log)' })
  timeline(@Param('tenantId') tenantId: string) {
    return this.service.timeline(tenantId);
  }

  @Post(':tenantId/subscription')
  @RequirePermissions(Permission.PLATFORM_SUBSCRIPTION_MANAGE)
  @ApiOperation({ summary: 'Change a school subscription (plan/cycle/status)' })
  changeSubscription(@Param('tenantId') tenantId: string, @Body() dto: ChangeSubscriptionDto) {
    return this.service.changeSubscription(tenantId, dto);
  }

  @Patch(':tenantId/subscription/status')
  @RequirePermissions(Permission.PLATFORM_SUBSCRIPTION_MANAGE)
  @ApiOperation({ summary: 'Set subscription status (suspend, cancel, reactivate, …)' })
  setStatus(@Param('tenantId') tenantId: string, @Body() dto: SetSubscriptionStatusDto) {
    return this.service.setStatus(tenantId, dto.status);
  }

  @Post(':tenantId/trial')
  @RequirePermissions(Permission.PLATFORM_TRIAL_MANAGE)
  @ApiOperation({ summary: 'Start a trial' })
  startTrial(@Param('tenantId') tenantId: string, @Body() dto: StartTrialDto) {
    return this.service.startTrial(tenantId, dto);
  }

  @Post(':tenantId/trial/extend')
  @RequirePermissions(Permission.PLATFORM_TRIAL_MANAGE)
  @ApiOperation({ summary: 'Extend a trial' })
  extendTrial(@Param('tenantId') tenantId: string, @Body() dto: ExtendTrialDto) {
    return this.service.extendTrial(tenantId, dto.days);
  }

  @Post(':tenantId/trial/end')
  @RequirePermissions(Permission.PLATFORM_TRIAL_MANAGE)
  @ApiOperation({ summary: 'End a trial (convert to paid, or expire)' })
  endTrial(@Param('tenantId') tenantId: string, @Body() dto: EndTrialDto) {
    return this.service.endTrial(tenantId, dto.convert);
  }

  @Get(':tenantId/billing')
  @RequirePermissions(Permission.PLATFORM_BILLING_READ)
  @ApiOperation({ summary: 'Get a school billing profile' })
  getBilling(@Param('tenantId') tenantId: string) {
    return this.service.getBillingProfile(tenantId);
  }

  @Post(':tenantId/billing')
  @RequirePermissions(Permission.PLATFORM_BILLING_MANAGE)
  @ApiOperation({ summary: 'Create or update a school billing profile' })
  upsertBilling(@Param('tenantId') tenantId: string, @Body() dto: UpsertBillingProfileDto) {
    return this.service.upsertBillingProfile(tenantId, dto);
  }

  @Get(':tenantId/overrides')
  @RequirePermissions(Permission.PLATFORM_FEATURE_OVERRIDE)
  @ApiOperation({ summary: 'List per-tenant feature overrides' })
  overrides(@Param('tenantId') tenantId: string) {
    return this.service.listOverrides(tenantId);
  }

  @Post(':tenantId/overrides')
  @RequirePermissions(Permission.PLATFORM_FEATURE_OVERRIDE)
  @ApiOperation({ summary: 'Set a per-tenant feature/limit override (audited)' })
  setOverride(@Param('tenantId') tenantId: string, @Body() dto: SetFeatureOverrideDto) {
    return this.service.setOverride(tenantId, dto);
  }

  @Delete(':tenantId/overrides/:key')
  @RequirePermissions(Permission.PLATFORM_FEATURE_OVERRIDE)
  @ApiOperation({ summary: 'Remove a per-tenant feature override' })
  deleteOverride(@Param('tenantId') tenantId: string, @Param('key') key: string) {
    return this.service.deleteOverride(tenantId, key);
  }
}
