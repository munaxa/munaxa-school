import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { AnalyticsService } from './analytics.service';

/** Notification analytics dashboard data (tenant-scoped). */
@ApiTags('notification-analytics')
@ApiBearerAuth()
@Controller({ path: 'notifications/analytics', version: '1' })
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get()
  @RequirePermissions(Permission.NOTIFICATION_SETTINGS)
  @ApiOperation({ summary: 'Delivery / read / open rates, failures, top categories, trends' })
  overview(@Query('rangeDays') rangeDays?: string) {
    const days = rangeDays ? Math.min(Math.max(parseInt(rangeDays, 10) || 30, 1), 365) : 30;
    return this.service.overview(days);
  }
}
