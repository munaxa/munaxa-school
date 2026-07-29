import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { AdvancePromotionDto, StartPromotionDto } from './tenant-provisioning.dto';

/**
 * Super-admin (platform plane) wizard for promoting a school to its own database
 * (pool → dedicated/silo). Drives a tracked, idempotent state machine; the destructive infra
 * steps (create DB, copy data) are operator-confirmed gates with runbook guidance.
 */
@ApiTags('platform')
@ApiBearerAuth()
@Controller({ path: 'platform/tenant-databases', version: '1' })
@RequirePermissions(Permission.PLATFORM_TENANT_MANAGE)
export class TenantProvisioningController {
  constructor(private readonly service: TenantProvisioningService) {}

  @Get()
  @ApiOperation({ summary: 'List all tenant-database promotions' })
  list() {
    return this.service.list();
  }

  @Post()
  @ApiOperation({ summary: 'Start (or restart) a promotion for a tenant' })
  start(@Body() dto: StartPromotionDto) {
    return this.service.start(dto);
  }

  @Get(':tenantId')
  @ApiOperation({ summary: 'Get the promotion status + step checklist for a tenant' })
  async get(@Param('tenantId') tenantId: string) {
    const view = await this.service.get(tenantId);
    if (!view) throw new NotFoundException('No promotion for this tenant');
    return view;
  }

  @Post(':tenantId/advance')
  @ApiOperation({ summary: 'Advance the wizard one step (or to FAILED/ABORTED)' })
  advance(@Param('tenantId') tenantId: string, @Body() dto: AdvancePromotionDto) {
    return this.service.advance(tenantId, dto);
  }
}
