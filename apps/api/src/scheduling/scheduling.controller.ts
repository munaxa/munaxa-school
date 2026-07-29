import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../auth/decorators/require-permissions.decorator';
import { SchedulingService } from './scheduling.service';

/**
 * Unified read surface for the scheduling engine. Every route is a different VIEW of the same
 * SchedulingService — there is no separate scheduling logic per portal.
 *
 *   GET /schedule/section   — a section's published weekly grid
 *   GET /schedule/day       — a section resolved for one date (exceptions applied)
 *   GET /schedule/current   — a section's live current/next class
 *   GET /schedule/student   — the acting student's inherited week + live class
 *   GET /schedule/teacher   — the acting teacher's day + live class
 */
@ApiTags('schedule')
@ApiBearerAuth()
@Controller({ path: 'schedule', version: '1' })
export class SchedulingController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Get('section')
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  @ApiQuery({ name: 'sectionId' })
  @ApiQuery({ name: 'date', required: false, description: 'ISO date; defaults to today' })
  @ApiOperation({ summary: "A section's published weekly schedule" })
  section(@Query('sectionId') sectionId: string, @Query('date') date?: string) {
    return this.scheduling.getSectionSchedule(sectionId, parseDate(date));
  }

  @Get('day')
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  @ApiQuery({ name: 'sectionId' })
  @ApiQuery({ name: 'date', required: false })
  @ApiOperation({ summary: 'A section resolved for a single date (exceptions applied)' })
  day(@Query('sectionId') sectionId: string, @Query('date') date?: string) {
    return this.scheduling.getSectionDay(sectionId, parseDate(date));
  }

  @Get('current')
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  @ApiQuery({ name: 'sectionId' })
  @ApiQuery({ name: 'at', required: false, description: 'ISO datetime; defaults to now' })
  @ApiOperation({ summary: "A section's live current/next class" })
  current(@Query('sectionId') sectionId: string, @Query('at') at?: string) {
    return this.scheduling.getCurrentSectionClass(sectionId, parseDateTime(at));
  }

  @Get('student')
  @RequireAnyPermission(Permission.TIMETABLE_READ, Permission.TIMETABLE_MANAGE)
  @ApiOperation({ summary: "The acting student's inherited week + live class" })
  async student(@Query('date') date?: string) {
    const sectionId = await this.scheduling.actingStudentSectionId();
    const [week, live] = await Promise.all([
      this.scheduling.getStudentSchedule(sectionId, parseDate(date)),
      this.scheduling.getStudentCurrentClass(sectionId),
    ]);
    return { sectionId, week, live };
  }

  @Get('teacher')
  @RequireAnyPermission(Permission.TIMETABLE_READ, Permission.TIMETABLE_MANAGE)
  @ApiOperation({ summary: "The acting teacher's day + live current class" })
  async teacher(@Query('at') at?: string) {
    const teacherId = await this.scheduling.requireActingTeacherId();
    return this.scheduling.getTeacherDay(teacherId, parseDateTime(at));
  }

  @Get('teacher/current')
  @RequireAnyPermission(Permission.TIMETABLE_READ, Permission.TIMETABLE_MANAGE)
  @ApiOperation({ summary: "The acting teacher's live current class" })
  async teacherCurrent(@Query('at') at?: string) {
    const teacherId = await this.scheduling.requireActingTeacherId();
    return this.scheduling.getCurrentTeacherClass(teacherId, parseDateTime(at));
  }
}

function parseDate(iso?: string): Date {
  if (!iso) return new Date();
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function parseDateTime(iso?: string): Date {
  if (!iso) return new Date();
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}
