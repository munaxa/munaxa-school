import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../../auth/decorators/require-permissions.decorator';
import { AttendancePolicyService } from './attendance-policy.service';
import { CreateAttendancePolicyDto, UpdateAttendancePolicyDto } from './attendance-policy.dto';

/** Attendance policy configuration (thresholds are data, never code). Thin controller. */
@ApiTags('staff-attendance')
@ApiBearerAuth()
@Controller({ path: 'hr/attendance/policies', version: '1' })
export class AttendancePolicyController {
  constructor(private readonly service: AttendancePolicyService) {}

  @Get()
  @RequirePermissions(Permission.ATTENDANCE_POLICY_READ)
  list() {
    return this.service.list();
  }

  @Get('effective')
  @RequirePermissions(Permission.ATTENDANCE_POLICY_READ)
  @ApiQuery({ name: 'campusId', required: false })
  @ApiOperation({ summary: 'The thresholds actually in force (campus override, else default)' })
  effective(@Query('campusId') campusId?: string) {
    return this.service.resolveConfig(campusId ?? null);
  }

  @Get(':id')
  @RequirePermissions(Permission.ATTENDANCE_POLICY_READ)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Post()
  @RequirePermissions(Permission.ATTENDANCE_POLICY_MANAGE)
  create(@Body() dto: CreateAttendancePolicyDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.ATTENDANCE_POLICY_MANAGE)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAttendancePolicyDto) {
    return this.service.update(id, dto);
  }
}
