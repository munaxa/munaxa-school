import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import {
  RequirePermissions,
  RequireAnyPermission,
} from '../../auth/decorators/require-permissions.decorator';
import { GradeService } from './grade.service';
import { CreateGradeDto, UpdateGradeDto } from './grade.dto';

@ApiTags('grades')
@ApiBearerAuth()
@Controller({ path: 'grades', version: '1' })
export class GradeController {
  constructor(private readonly service: GradeService) {}

  @Post()
  @RequirePermissions(Permission.GRADE_MANAGE)
  create(@Body() dto: CreateGradeDto) {
    return this.service.create(dto);
  }

  // Admissions roles (registrar/finance) need to list/read grades to build a quote.
  @Get()
  @RequireAnyPermission(Permission.GRADE_MANAGE, Permission.ENROLLMENT_MANAGE)
  @ApiQuery({ name: 'campusId', required: false })
  list(@Query('campusId') campusId?: string) {
    return this.service.list(campusId);
  }

  @Get(':id')
  @RequireAnyPermission(Permission.GRADE_MANAGE, Permission.ENROLLMENT_MANAGE)
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.GRADE_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateGradeDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.GRADE_MANAGE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
