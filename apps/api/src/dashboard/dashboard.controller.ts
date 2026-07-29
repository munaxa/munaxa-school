import { Body, Controller, Get, Headers, Ip, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DashboardRepository } from './dashboard.repository';
import { RevealDto } from './dashboard.dto';

/** Tenant-wide KPI overview for the admin landing dashboard. */
@ApiTags('dashboard')
@ApiBearerAuth()
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly repo: DashboardRepository) {}

  @Get('overview')
  @RequirePermissions(Permission.REPORT_READ)
  @ApiOperation({
    summary: 'Students, staff, today attendance, finance, e-invoice, recent activity',
  })
  overview(@CurrentUser() user: AuthenticatedUser) {
    // Financial figures are only computed into the payload for callers holding finance:read.
    const includeFinance = user.isPlatform || user.permissions.includes(Permission.FINANCE_READ);
    return this.repo.overview(includeFinance);
  }

  @Post('reveal')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({ summary: 'Audit a reveal of masked financial figures (who/what/when)' })
  async reveal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RevealDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    await this.repo.recordReveal({
      actorUserId: user.userId,
      actorRole: user.roles[0] ?? null,
      scope: dto.scope,
      ip,
      userAgent: userAgent ?? null,
    });
    return { ok: true };
  }
}
