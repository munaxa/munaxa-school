import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { TeacherAttendanceService } from './teacher-attendance.service';
import { MarkTeacherAttendanceDto } from './teacher-attendance.dto';

@ApiTags('attendance')
@ApiBearerAuth()
@Controller({ path: 'attendance/teachers', version: '1' })
export class TeacherAttendanceController {
  constructor(private readonly service: TeacherAttendanceService) {}

  @Post()
  @HttpCode(200)
  @RequirePermissions(Permission.ATTENDANCE_CREATE)
  mark(@Body() dto: MarkTeacherAttendanceDto) {
    return this.service.mark(dto);
  }

  @Get()
  @RequirePermissions(Permission.ATTENDANCE_READ)
  @ApiQuery({ name: 'date', required: true })
  list(@Query('date') date: string) {
    return this.service.listForDate(date);
  }
}
