import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../../auth/decorators/require-permissions.decorator';
import { AttendanceLockService } from './attendance-lock.service';
import {
  CreateAttendanceLockDto,
  ListAttendanceLocksQueryDto,
  ReleaseAttendanceLockDto,
} from './attendance-lock.dto';

/** Attendance immutability windows (daily / weekly / payroll / semester). Thin controller. */
@ApiTags('staff-attendance')
@ApiBearerAuth()
@Controller({ path: 'hr/attendance/locks', version: '1' })
export class AttendanceLockController {
  constructor(private readonly service: AttendanceLockService) {}

  @Get()
  @RequirePermissions(Permission.STAFF_ATTENDANCE_READ)
  @ApiOperation({ summary: 'List attendance locks' })
  list(@Query() query: ListAttendanceLocksQueryDto) {
    return this.service.list(query);
  }

  @Post()
  @RequirePermissions(Permission.ATTENDANCE_LOCK_MANAGE)
  @ApiOperation({ summary: 'Lock a period against further attendance edits' })
  create(@Body() dto: CreateAttendanceLockDto) {
    return this.service.create(dto);
  }

  @Post(':id/release')
  @RequirePermissions(Permission.ATTENDANCE_LOCK_MANAGE)
  @ApiOperation({ summary: 'Release (reopen) a locked period — audited' })
  release(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReleaseAttendanceLockDto) {
    return this.service.release(id, dto);
  }
}
