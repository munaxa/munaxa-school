import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { TeacherService } from './teacher.service';
import { AssignSectionDto, CreateTeacherDto, UpdateTeacherDto } from './teacher.dto';

@ApiTags('teachers')
@ApiBearerAuth()
@Controller({ path: 'teachers', version: '1' })
export class TeacherController {
  constructor(private readonly service: TeacherService) {}

  @Post()
  @RequirePermissions(Permission.TEACHER_MANAGE)
  create(@Body() dto: CreateTeacherDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequirePermissions(Permission.TEACHER_MANAGE)
  list() {
    return this.service.list();
  }

  @Get(':id')
  @RequirePermissions(Permission.TEACHER_MANAGE)
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.TEACHER_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateTeacherDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.TEACHER_MANAGE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ----- Section assignment ------------------------------------------------
  @Post(':id/sections')
  @RequirePermissions(Permission.TEACHER_MANAGE)
  @ApiOperation({ summary: 'Assign a teacher to a section (optionally a subject)' })
  assignSection(@Param('id') id: string, @Body() dto: AssignSectionDto) {
    return this.service.assignSection(id, dto);
  }

  @Get(':id/sections')
  @RequirePermissions(Permission.TEACHER_MANAGE)
  listSections(@Param('id') id: string) {
    return this.service.listSections(id);
  }

  @Delete(':id/sections/:assignmentId')
  @HttpCode(204)
  @RequirePermissions(Permission.TEACHER_MANAGE)
  unassign(@Param('id') id: string, @Param('assignmentId') assignmentId: string) {
    return this.service.unassign(id, assignmentId);
  }
}
