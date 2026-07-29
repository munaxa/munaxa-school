import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import {
  RequirePermissions,
  RequireAnyPermission,
} from '../../auth/decorators/require-permissions.decorator';
import { SchedulePlanService } from './schedule-plan.service';
import {
  BulkReplaceSubjectDto,
  BulkReplaceTeacherDto,
  ClearDayDto,
  ClearSectionDto,
  CopySemesterDto,
  CreateClassDto,
  CreatePlanDto,
  DuplicatePlanDto,
  UpdateClassDto,
  UpdatePlanDto,
} from './schedule-plan.dto';

@ApiTags('schedule-plans')
@ApiBearerAuth()
@Controller({ path: 'schedule/plans', version: '1' })
export class SchedulePlanController {
  constructor(private readonly service: SchedulePlanService) {}

  @Post()
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  create(@Body() dto: CreatePlanDto) {
    return this.service.create(dto);
  }

  @Post('copy-semester')
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  copySemester(@Body() dto: CopySemesterDto) {
    return this.service.copySemester(dto);
  }

  @Get()
  @RequireAnyPermission(Permission.TIMETABLE_MANAGE, Permission.TIMETABLE_READ)
  @ApiQuery({ name: 'semesterId', required: false })
  list(@Query('semesterId') semesterId?: string) {
    return this.service.list(semesterId);
  }

  @Get(':id')
  @RequireAnyPermission(Permission.TIMETABLE_MANAGE, Permission.TIMETABLE_READ)
  overview(@Param('id') id: string) {
    return this.service.overview(id);
  }

  @Get(':id/validate')
  @RequireAnyPermission(Permission.TIMETABLE_MANAGE, Permission.TIMETABLE_READ)
  validate(@Param('id') id: string) {
    return this.service.validate(id);
  }

  @Get(':id/sections/:sectionId/classes')
  @RequireAnyPermission(Permission.TIMETABLE_MANAGE, Permission.TIMETABLE_READ)
  sectionClasses(@Param('id') id: string, @Param('sectionId') sectionId: string) {
    return this.service.sectionClasses(id, sectionId);
  }

  @Patch(':id')
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/publish')
  @HttpCode(200)
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  publish(@Param('id') id: string) {
    return this.service.publish(id);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  archive(@Param('id') id: string) {
    return this.service.archive(id);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  restore(@Param('id') id: string) {
    return this.service.restore(id);
  }

  @Post(':id/duplicate')
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  duplicate(@Param('id') id: string, @Body() dto: DuplicatePlanDto) {
    return this.service.duplicate(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ----- Class management ---------------------------------------------------

  @Post(':id/classes')
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  addClass(@Param('id') id: string, @Body() dto: CreateClassDto) {
    return this.service.addClass(id, dto);
  }

  @Patch(':id/classes/:classId')
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  updateClass(
    @Param('id') id: string,
    @Param('classId') classId: string,
    @Body() dto: UpdateClassDto,
  ) {
    return this.service.updateClass(id, classId, dto);
  }

  @Delete(':id/classes/:classId')
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  deleteClass(@Param('id') id: string, @Param('classId') classId: string) {
    return this.service.deleteClass(id, classId);
  }

  @Post(':id/clear-day')
  @HttpCode(200)
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  clearDay(@Param('id') id: string, @Body() dto: ClearDayDto) {
    return this.service.clearDay(id, dto);
  }

  @Post(':id/clear-section')
  @HttpCode(200)
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  clearSection(@Param('id') id: string, @Body() dto: ClearSectionDto) {
    return this.service.clearSection(id, dto);
  }

  @Post(':id/bulk/replace-teacher')
  @HttpCode(200)
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  bulkReplaceTeacher(@Param('id') id: string, @Body() dto: BulkReplaceTeacherDto) {
    return this.service.bulkReplaceTeacher(id, dto);
  }

  @Post(':id/bulk/replace-subject')
  @HttpCode(200)
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  bulkReplaceSubject(@Param('id') id: string, @Body() dto: BulkReplaceSubjectDto) {
    return this.service.bulkReplaceSubject(id, dto);
  }
}
