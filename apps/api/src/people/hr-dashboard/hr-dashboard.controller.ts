import { Controller, Get, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ExportService } from '../../reporting/export/export.service';
import { HrDashboardService } from './hr-dashboard.service';
import { AlertsQueryDto, RosterExportQueryDto } from './hr-dashboard.dto';

/** HR analytics dashboard, alerts feed, and the headcount roster export. */
@ApiTags('hr-dashboard')
@ApiBearerAuth()
@Controller({ path: 'hr/dashboard', version: '1' })
export class HrDashboardController {
  constructor(
    private readonly service: HrDashboardService,
    private readonly exporter: ExportService,
  ) {}

  @Get()
  @RequirePermissions(Permission.HR_DASHBOARD_READ)
  @ApiOperation({ summary: 'Aggregate HR KPIs (headcount, leave, recruitment, assets, expiring)' })
  dashboard() {
    return this.service.dashboard();
  }

  @Get('alerts')
  @RequirePermissions(Permission.HR_DASHBOARD_READ)
  @ApiOperation({
    summary: 'Actionable HR alerts (expiring docs/contracts/certs/training, probation)',
  })
  alerts(@Query() query: AlertsQueryDto) {
    return this.service.alerts(query.within ?? 60);
  }

  @Get('roster/export')
  @RequirePermissions(Permission.HR_DASHBOARD_READ)
  @ApiOperation({ summary: 'Export the employee headcount roster (csv|xlsx|pdf)' })
  async rosterExport(
    @Query() query: RosterExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const table = await this.service.rosterReport();
    const { buffer, contentType, filename } = await this.exporter.render(
      table,
      query.format ?? 'csv',
      'hr-roster',
    );
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(buffer);
  }
}
