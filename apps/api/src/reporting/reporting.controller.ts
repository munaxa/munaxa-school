import { Controller, Get, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ReportingService } from './reporting.service';
import { ExportService } from './export/export.service';
import { ExportQueryDto, ReportQueryDto } from './reporting.query.dto';
import type { ReportTable } from './export/report.types';

@ApiTags('reporting')
@ApiBearerAuth()
@Controller({ path: 'reports', version: '1' })
export class ReportingController {
  constructor(
    private readonly reports: ReportingService,
    private readonly exporter: ExportService,
  ) {}

  // ----- Attendance ----------------------------------------------------------
  @Get('attendance')
  @RequirePermissions(Permission.REPORT_READ)
  @ApiOperation({ summary: 'Attendance summary per student' })
  attendance(@Query() q: ReportQueryDto) {
    return this.reports.attendance(q);
  }

  @Get('attendance/export')
  @RequirePermissions(Permission.REPORT_EXPORT)
  @ApiOperation({ summary: 'Export the attendance report (csv|xlsx|pdf)' })
  attendanceExport(@Query() q: ExportQueryDto, @Res({ passthrough: true }) res: Response) {
    return this.download(this.reports.attendance(q), q, 'attendance-report', res);
  }

  // ----- Academic ------------------------------------------------------------
  @Get('academic')
  @RequirePermissions(Permission.REPORT_READ)
  @ApiOperation({ summary: 'Academic (grades) summary per student' })
  academic(@Query() q: ReportQueryDto) {
    return this.reports.academic(q);
  }

  @Get('academic/export')
  @RequirePermissions(Permission.REPORT_EXPORT)
  @ApiOperation({ summary: 'Export the academic report (csv|xlsx|pdf)' })
  academicExport(@Query() q: ExportQueryDto, @Res({ passthrough: true }) res: Response) {
    return this.download(this.reports.academic(q), q, 'academic-report', res);
  }

  // ----- Financial -----------------------------------------------------------
  @Get('financial')
  @RequirePermissions(Permission.REPORT_READ)
  @ApiOperation({ summary: 'Financial summary per student (charged/paid/outstanding)' })
  financial(@Query() q: ReportQueryDto) {
    return this.reports.financial(q);
  }

  @Get('financial/export')
  @RequirePermissions(Permission.REPORT_EXPORT)
  @ApiOperation({ summary: 'Export the financial report (csv|xlsx|pdf)' })
  financialExport(@Query() q: ExportQueryDto, @Res({ passthrough: true }) res: Response) {
    return this.download(this.reports.financial(q), q, 'financial-report', res);
  }

  // ----- Behavior ------------------------------------------------------------
  @Get('behavior')
  @RequirePermissions(Permission.REPORT_READ)
  @ApiOperation({ summary: 'Behavior summary per student' })
  behavior(@Query() q: ReportQueryDto) {
    return this.reports.behavior(q);
  }

  @Get('behavior/export')
  @RequirePermissions(Permission.REPORT_EXPORT)
  @ApiOperation({ summary: 'Export the behavior report (csv|xlsx|pdf)' })
  behaviorExport(@Query() q: ExportQueryDto, @Res({ passthrough: true }) res: Response) {
    return this.download(this.reports.behavior(q), q, 'behavior-report', res);
  }

  private async download(
    tablePromise: Promise<ReportTable>,
    q: ExportQueryDto,
    baseName: string,
    res: Response,
  ): Promise<StreamableFile> {
    const table = await tablePromise;
    const { buffer, contentType, filename } = await this.exporter.render(
      table,
      q.format ?? 'csv',
      baseName,
    );
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(buffer);
  }
}
