import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import {
  RequirePermissions,
  RequireAnyPermission,
} from '../../auth/decorators/require-permissions.decorator';
import { AcademicYearService } from './academic-year.service';
import { CreateAcademicYearDto, UpdateAcademicYearDto } from './academic-year.dto';

@ApiTags('academic-years')
@ApiBearerAuth()
@Controller({ path: 'academic-years', version: '1' })
export class AcademicYearController {
  constructor(private readonly service: AcademicYearService) {}

  @Post()
  @RequirePermissions(Permission.ACADEMICYEAR_MANAGE)
  create(@Body() dto: CreateAcademicYearDto) {
    return this.service.create(dto);
  }

  // Admissions roles (registrar/finance) need to list/read academic years to build a quote.
  @Get()
  @RequireAnyPermission(Permission.ACADEMICYEAR_MANAGE, Permission.ENROLLMENT_MANAGE)
  @ApiQuery({ name: 'campusId', required: false })
  list(@Query('campusId') campusId?: string) {
    return this.service.list(campusId);
  }

  // The current (ACTIVE) academic year — used by the app-shell indicator and defaults resolution.
  @Get('current')
  @RequireAnyPermission(Permission.ACADEMICYEAR_MANAGE, Permission.ENROLLMENT_MANAGE)
  @ApiQuery({ name: 'schoolId', required: false })
  current(@Query('schoolId') schoolId?: string) {
    return this.service.current(schoolId);
  }

  @Get(':id')
  @RequireAnyPermission(Permission.ACADEMICYEAR_MANAGE, Permission.ENROLLMENT_MANAGE)
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  // Operational metrics for the Academic Year workspace card (read-only aggregation).
  @Get(':id/overview')
  @RequireAnyPermission(Permission.ACADEMICYEAR_MANAGE, Permission.ENROLLMENT_MANAGE)
  overview(@Param('id') id: string) {
    return this.service.overview(id);
  }

  // Pre-flight validation: activation checklist, close checklist, and the Academic Readiness Score.
  @Get(':id/readiness')
  @RequirePermissions(Permission.ACADEMICYEAR_MANAGE)
  readiness(@Param('id') id: string) {
    return this.service.readiness(id);
  }

  // Whether the year may be deleted (only if completely unused) + the blocking usage.
  @Get(':id/deletable')
  @RequirePermissions(Permission.ACADEMICYEAR_MANAGE)
  deletable(@Param('id') id: string) {
    return this.service.deletability(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.ACADEMICYEAR_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateAcademicYearDto) {
    return this.service.update(id, dto);
  }

  // Close an academic year (administrative event; never mutates Student/Enrollment). Decision 8.
  @Post(':id/close')
  @RequirePermissions(Permission.ACADEMICYEAR_MANAGE)
  close(@Param('id') id: string) {
    return this.service.close(id);
  }

  // Academic years are never deletable (Decision 8) — the service refuses with 400. Kept so the route
  // returns a clear "use close instead" error rather than a 404.
  @Delete(':id')
  @RequirePermissions(Permission.ACADEMICYEAR_MANAGE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
