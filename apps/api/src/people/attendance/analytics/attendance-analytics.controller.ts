import { Controller, Get, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../../auth/decorators/require-permissions.decorator';
import { ExportService } from '../../../reporting/export/export.service';
import { REPORT_FORMATS, type ReportFormat } from '../../../reporting/export/report.types';
import {
  AttendanceAnalyticsService,
  type AttendanceAnalytics,
} from './attendance-analytics.service';

/**
 * Attendance analytics. Reuses the existing export pipeline for downloads and the existing HR
 * dashboard permission — no new analytics abstraction, no new permission (ownership matrix C9/C10).
 */
@ApiTags('staff-attendance')
@ApiBearerAuth()
@Controller({ path: 'hr/attendance/analytics', version: '1' })
export class AttendanceAnalyticsController {
  constructor(
    private readonly service: AttendanceAnalyticsService,
    private readonly exporter: ExportService,
  ) {}

  @Get()
  @RequirePermissions(Permission.HR_DASHBOARD_READ)
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiQuery({ name: 'granularity', required: false, enum: ['day', 'month'] })
  @ApiOperation({ summary: 'Attendance trends, department heatmap and punctuality ranking' })
  analytics(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('departmentId') departmentId?: string,
    @Query('granularity') granularity?: 'day' | 'month',
  ): Promise<AttendanceAnalytics> {
    return this.service.analytics({
      from,
      to,
      ...(departmentId !== undefined ? { departmentId } : {}),
      ...(granularity !== undefined ? { granularity } : {}),
    });
  }

  @Get('departments/export')
  @RequirePermissions(Permission.HR_DASHBOARD_READ)
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  @ApiQuery({ name: 'format', required: true, enum: REPORT_FORMATS })
  @ApiOperation({ summary: 'Export the department heatmap (csv|xlsx|pdf)' })
  async exportDepartments(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('format') format: ReportFormat,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const result = await this.service.analytics({ from, to });
    return this.download(
      this.service.toDepartmentTable(result),
      format,
      'attendance-departments',
      res,
    );
  }

  @Get('punctuality/export')
  @RequirePermissions(Permission.HR_DASHBOARD_READ)
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  @ApiQuery({ name: 'format', required: true, enum: REPORT_FORMATS })
  @ApiOperation({ summary: 'Export the punctuality ranking (csv|xlsx|pdf)' })
  async exportPunctuality(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('format') format: ReportFormat,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const result = await this.service.analytics({ from, to });
    return this.download(
      this.service.toPunctualityTable(result),
      format,
      'attendance-punctuality',
      res,
    );
  }

  private async download(
    table: Parameters<ExportService['render']>[0],
    format: ReportFormat,
    filenameBase: string,
    res: Response,
  ): Promise<StreamableFile> {
    const { buffer, contentType, filename } = await this.exporter.render(
      table,
      format,
      filenameBase,
    );
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(buffer);
  }
}
