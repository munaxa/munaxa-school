import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ClassroomService } from './classroom.service';
import { CreateClassroomDto, UpdateClassroomDto } from './classroom.dto';

@ApiTags('classrooms')
@ApiBearerAuth()
@Controller({ path: 'classrooms', version: '1' })
export class ClassroomController {
  constructor(private readonly service: ClassroomService) {}

  @Post()
  @RequirePermissions(Permission.CLASSROOM_MANAGE)
  create(@Body() dto: CreateClassroomDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequirePermissions(Permission.CLASSROOM_MANAGE)
  @ApiQuery({ name: 'campusId', required: false })
  list(@Query('campusId') campusId?: string) {
    return this.service.list(campusId);
  }

  @Get(':id')
  @RequirePermissions(Permission.CLASSROOM_MANAGE)
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CLASSROOM_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateClassroomDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.CLASSROOM_MANAGE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
