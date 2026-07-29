import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { TeacherAvailabilityService } from './teacher-availability.service';

/**
 * Teacher availability (read-only). Consumed by academic scheduling to decide whether a teacher can
 * take their classes on a date. Thin controller — all logic lives in the service (Rule 5).
 */
@ApiTags('attendance')
@ApiBearerAuth()
@Controller({ path: 'attendance/teachers', version: '1' })
export class TeacherAvailabilityController {
  constructor(private readonly service: TeacherAvailabilityService) {}

  @Get(':teacherId/availability')
  @RequirePermissions(Permission.ATTENDANCE_READ)
  @ApiQuery({ name: 'date', required: true, example: '2026-03-08' })
  @ApiOperation({ summary: 'Whether a teacher can teach on a date, and why not' })
  forTeacher(@Param('teacherId', ParseUUIDPipe) teacherId: string, @Query('date') date: string) {
    return this.service.forTeacher(teacherId, date);
  }

  @Get('availability')
  @RequirePermissions(Permission.ATTENDANCE_READ)
  @ApiQuery({ name: 'date', required: true, example: '2026-03-08' })
  @ApiQuery({ name: 'teacherIds', required: true, description: 'Comma-separated teacher ids' })
  @ApiOperation({ summary: 'Batch availability for a roster of teachers on one date' })
  forTeachers(@Query('date') date: string, @Query('teacherIds') teacherIds: string) {
    const ids = teacherIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    return this.service.forTeachers(ids, date);
  }
}
