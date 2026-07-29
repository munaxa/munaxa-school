import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import {
  RequirePermissions,
  RequireAnyPermission,
} from '../../auth/decorators/require-permissions.decorator';
import { SubjectService } from './subject.service';
import { CreateSubjectDto, UpdateSubjectDto } from './subject.dto';

@ApiTags('subjects')
@ApiBearerAuth()
@Controller({ path: 'subjects', version: '1' })
export class SubjectController {
  constructor(private readonly service: SubjectService) {}

  @Post()
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  create(@Body() dto: CreateSubjectDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequireAnyPermission(Permission.TIMETABLE_MANAGE, Permission.TIMETABLE_READ)
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  list(@Query('includeInactive') includeInactive?: string) {
    return this.service.list(includeInactive === 'true');
  }

  @Get(':id')
  @RequireAnyPermission(Permission.TIMETABLE_MANAGE, Permission.TIMETABLE_READ)
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateSubjectDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.TIMETABLE_MANAGE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
