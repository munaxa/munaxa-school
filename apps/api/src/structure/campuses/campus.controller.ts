import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import {
  RequirePermissions,
  RequireAnyPermission,
} from '../../auth/decorators/require-permissions.decorator';
import { CampusService } from './campus.service';
import { CreateCampusDto, UpdateCampusDto } from './campus.dto';

@ApiTags('campuses')
@ApiBearerAuth()
@Controller({ path: 'campuses', version: '1' })
export class CampusController {
  constructor(private readonly service: CampusService) {}

  @Post()
  @RequirePermissions(Permission.CAMPUS_MANAGE)
  @ApiOperation({ summary: 'Create a campus' })
  create(@Body() dto: CreateCampusDto) {
    return this.service.create(dto);
  }

  // Admissions roles (registrar/finance) need to list/read campuses to build a quote.
  @Get()
  @RequireAnyPermission(Permission.CAMPUS_MANAGE, Permission.ENROLLMENT_MANAGE)
  @ApiQuery({ name: 'schoolId', required: false })
  @ApiOperation({ summary: 'List campuses (optionally filtered by school)' })
  list(@Query('schoolId') schoolId?: string) {
    return this.service.list(schoolId);
  }

  @Get(':id')
  @RequireAnyPermission(Permission.CAMPUS_MANAGE, Permission.ENROLLMENT_MANAGE)
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CAMPUS_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateCampusDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.CAMPUS_MANAGE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
