import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import {
  RequirePermissions,
  RequireAnyPermission,
} from '../../auth/decorators/require-permissions.decorator';
import { ScheduleExceptionService } from './schedule-exception.service';
import { CreateExceptionDto } from './schedule-exception.dto';

@ApiTags('schedule')
@ApiBearerAuth()
@Controller({ path: 'schedule/exceptions', version: '1' })
export class ScheduleExceptionController {
  constructor(private readonly service: ScheduleExceptionService) {}

  @Post()
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  create(@Body() dto: CreateExceptionDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequireAnyPermission(Permission.TIMETABLE_MANAGE, Permission.TIMETABLE_READ)
  @ApiQuery({ name: 'sectionId', required: false })
  @ApiQuery({ name: 'date', required: false })
  list(@Query('sectionId') sectionId?: string, @Query('date') date?: string) {
    return this.service.list(sectionId, date);
  }

  @Delete(':id')
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
