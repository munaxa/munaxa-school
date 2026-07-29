import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../auth/decorators/require-permissions.decorator';
import { SectionService } from './section.service';
import { CreateSectionDto, UpdateSectionDto } from './section.dto';

@ApiTags('sections')
@ApiBearerAuth()
@Controller({ path: 'sections', version: '1' })
export class SectionController {
  constructor(private readonly service: SectionService) {}

  @Post()
  @RequirePermissions(Permission.SECTION_MANAGE)
  create(@Body() dto: CreateSectionDto) {
    return this.service.create(dto);
  }

  @Get()
  // Readable by structure managers AND attendance markers (teachers picking a class roster).
  @RequireAnyPermission(Permission.SECTION_MANAGE, Permission.ATTENDANCE_CREATE)
  @ApiQuery({ name: 'gradeId', required: false })
  list(@Query('gradeId') gradeId?: string) {
    return this.service.list(gradeId);
  }

  @Get(':id')
  @RequireAnyPermission(Permission.SECTION_MANAGE, Permission.ATTENDANCE_CREATE)
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.SECTION_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateSectionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.SECTION_MANAGE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
