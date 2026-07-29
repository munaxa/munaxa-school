import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { SemesterService } from './semester.service';
import { CreateSemesterDto, UpdateSemesterDto } from './semester.dto';

@ApiTags('semesters')
@ApiBearerAuth()
@Controller({ path: 'semesters', version: '1' })
export class SemesterController {
  constructor(private readonly service: SemesterService) {}

  @Post()
  @RequirePermissions(Permission.ACADEMICYEAR_MANAGE)
  create(@Body() dto: CreateSemesterDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequirePermissions(Permission.ACADEMICYEAR_MANAGE)
  @ApiQuery({ name: 'academicYearId', required: false })
  list(@Query('academicYearId') academicYearId?: string) {
    return this.service.list(academicYearId);
  }

  @Get(':id')
  @RequirePermissions(Permission.ACADEMICYEAR_MANAGE)
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.ACADEMICYEAR_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateSemesterDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.ACADEMICYEAR_MANAGE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
