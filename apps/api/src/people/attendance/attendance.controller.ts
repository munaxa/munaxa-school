import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ExportService } from '../../reporting/export/export.service';
import { AttendanceService, type PayrollPrepResult } from './attendance.service';
import {
  BulkAttendanceDto,
  DailyAttendanceQueryDto,
  ListAttendanceQueryDto,
  PayrollPrepQueryDto,
  RecordAttendanceDto,
} from './attendance.dto';

/** HR-facing daily roster (bulk marking), roster view, and payroll preparation. */
@ApiTags('staff-attendance')
@ApiBearerAuth()
@Controller({ path: 'hr', version: '1' })
export class AttendanceController {
  constructor(
    private readonly service: AttendanceService,
    private readonly exporter: ExportService,
  ) {}

  @Get('attendance')
  @RequirePermissions(Permission.STAFF_ATTENDANCE_READ)
  @ApiOperation({ summary: 'Daily staff attendance roster for one date' })
  daily(@Query() query: DailyAttendanceQueryDto) {
    return this.service.listForDate(query.date);
  }

  @Post('attendance/bulk')
  @RequirePermissions(Permission.STAFF_ATTENDANCE_MANAGE)
  @ApiOperation({ summary: 'Mark many employees for a single date' })
  bulk(@Body() dto: BulkAttendanceDto) {
    return this.service.bulk(dto);
  }

  @Get('payroll-prep/validated')
  @RequirePermissions(Permission.PAYROLL_PREPARE)
  @ApiOperation({
    summary: 'Validated payroll summary — proves the period is locked and free of open corrections',
  })
  payrollPrepValidated(@Query() query: PayrollPrepQueryDto) {
    return this.service.payrollPrepValidated(query);
  }

  @Get('payroll-prep')
  @RequirePermissions(Permission.PAYROLL_PREPARE)
  @ApiOperation({ summary: 'Payroll-preparation summary (JSON, or csv|xlsx|pdf via ?format=)' })
  async payrollPrep(
    @Query() query: PayrollPrepQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PayrollPrepResult | StreamableFile> {
    const result = await this.service.payrollPrep(query);
    if (!query.format) return result;
    const { buffer, contentType, filename } = await this.exporter.render(
      this.service.toReportTable(result),
      query.format,
      'payroll-prep',
    );
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(buffer);
  }
}

/** Employee-scoped attendance history + single-day recording/correction. */
@ApiTags('staff-attendance')
@ApiBearerAuth()
@Controller({ path: 'employees/:employeeId/attendance', version: '1' })
export class EmployeeAttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Get()
  @RequirePermissions(Permission.STAFF_ATTENDANCE_READ)
  list(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: ListAttendanceQueryDto,
  ) {
    return this.service.listForEmployee(employeeId, query);
  }

  @Post()
  @RequirePermissions(Permission.STAFF_ATTENDANCE_MANAGE)
  @ApiOperation({ summary: 'Record or correct one day of attendance (upsert)' })
  record(@Param('employeeId', ParseUUIDPipe) employeeId: string, @Body() dto: RecordAttendanceDto) {
    return this.service.record(employeeId, dto);
  }
}
