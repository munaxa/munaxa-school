import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SubscriptionService } from './subscription.service';
import { CreateUpgradeRequestDto } from './subscription.dto';
import { AllowInReadOnly } from './allow-in-read-only.decorator';

/**
 * School-plane subscription surface (Settings → Subscription). A school can VIEW its plan,
 * usage, limits and renewal, and REQUEST a plan change — but can never change its own
 * subscription. Upgrade requests are reviewed and applied by the Platform Console.
 */
@ApiTags('subscription')
@ApiBearerAuth()
@Controller({ path: 'subscription', version: '1' })
export class SubscriptionController {
  constructor(private readonly subscriptions: SubscriptionService) {}

  @Get()
  @RequirePermissions(Permission.SUBSCRIPTION_READ)
  @ApiOperation({ summary: 'Current plan, usage, limits, trial and renewal for this school' })
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptions.summary(user.tenantId);
  }

  @Get('plans')
  @RequirePermissions(Permission.SUBSCRIPTION_READ)
  @ApiOperation({ summary: 'Active plans this school can upgrade to' })
  plans(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptions.listPlans(user.tenantId);
  }

  @Get('upgrade-requests')
  @RequirePermissions(Permission.SUBSCRIPTION_READ)
  @ApiOperation({ summary: "This school's upgrade requests" })
  upgradeRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptions.listUpgradeRequests(user.tenantId);
  }

  @Post('upgrade-requests')
  @AllowInReadOnly()
  @RequirePermissions(Permission.SUBSCRIPTION_UPGRADE_REQUEST)
  @ApiOperation({ summary: 'Request a plan change (reviewed by Munaxa — not applied immediately)' })
  requestUpgrade(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUpgradeRequestDto) {
    return this.subscriptions.requestUpgrade(user.tenantId, {
      requestedPlanId: dto.requestedPlanId,
      requestedCycle: dto.requestedCycle ?? null,
      note: dto.note ?? null,
    });
  }
}
