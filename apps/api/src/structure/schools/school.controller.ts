import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import {
  RequirePermissions,
  RequireAnyPermission,
} from '../../auth/decorators/require-permissions.decorator';
import { SchoolService } from './school.service';
import { CreateSchoolDto, UpdateSchoolDto } from './school.dto';

@ApiTags('schools')
@ApiBearerAuth()
@Controller({ path: 'schools', version: '1' })
export class SchoolController {
  constructor(private readonly service: SchoolService) {}

  @Post()
  @RequirePermissions(Permission.SCHOOL_MANAGE)
  @ApiOperation({ summary: 'Create a school' })
  create(@Body() dto: CreateSchoolDto) {
    return this.service.create(dto);
  }

  // Reads are also needed by admissions roles (registrar/finance) to pick a school
  // when building a quote — allow ENROLLMENT_MANAGE in addition to SCHOOL_MANAGE.
  @Get()
  @RequireAnyPermission(Permission.SCHOOL_MANAGE, Permission.ENROLLMENT_MANAGE)
  @ApiOperation({ summary: 'List schools in the current tenant' })
  list() {
    return this.service.list();
  }

  @Get(':id')
  @RequireAnyPermission(Permission.SCHOOL_MANAGE, Permission.ENROLLMENT_MANAGE)
  @ApiOperation({ summary: 'Get a school by id' })
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.SCHOOL_MANAGE)
  @ApiOperation({ summary: 'Update a school' })
  update(@Param('id') id: string, @Body() dto: UpdateSchoolDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.SCHOOL_MANAGE)
  @ApiOperation({ summary: 'Soft-delete a school' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
