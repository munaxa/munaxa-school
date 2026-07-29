import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { StudentStatus } from '@prisma/client';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../auth/decorators/require-permissions.decorator';
import { StudentService } from './student.service';
import {
  CreateStudentDto,
  CreateVaccineDto,
  ImportStudentsDto,
  LinkParentDto,
  UpdateStudentDto,
  UpdateVaccineDto,
} from './student.dto';

@ApiTags('students')
@ApiBearerAuth()
@Controller({ path: 'students', version: '1' })
export class StudentController {
  constructor(private readonly service: StudentService) {}

  @Post()
  @RequirePermissions(Permission.STUDENT_MANAGE)
  @ApiOperation({ summary: 'Create a student (QR code auto-generated)' })
  create(@Body() dto: CreateStudentDto) {
    return this.service.create(dto);
  }

  @Post('import')
  @RequirePermissions(Permission.STUDENT_MANAGE)
  @ApiOperation({ summary: 'Bulk-import students from CSV' })
  import(@Body() dto: ImportStudentsDto) {
    return this.service.importCsv(dto.csv);
  }

  @Get()
  // Listable by people managers AND attendance markers (teachers loading a class roster).
  @RequireAnyPermission(Permission.STUDENT_MANAGE, Permission.ATTENDANCE_CREATE)
  @ApiQuery({ name: 'sectionId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: StudentStatus })
  @ApiQuery({
    name: 'search',
    required: false,
    description:
      'Matches across name parts (given/father/grandfather/family, EN+AR), national ID, MoE no.',
  })
  list(
    @Query('sectionId') sectionId?: string,
    @Query('status') status?: StudentStatus,
    @Query('search') search?: string,
  ) {
    return this.service.list({ sectionId, status, search });
  }

  @Get(':id')
  @RequirePermissions(Permission.STUDENT_MANAGE)
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Get(':id/qr')
  @RequirePermissions(Permission.STUDENT_MANAGE)
  @ApiOperation({ summary: 'Get a student QR identity code' })
  qr(@Param('id') id: string) {
    return this.service.qr(id);
  }

  @Get(':id/enrollment-history')
  @RequirePermissions(Permission.STUDENT_MANAGE)
  @ApiOperation({
    summary: 'Immutable per-year Enrollment History (year · grade · status · dates)',
  })
  enrollmentHistory(@Param('id') id: string) {
    return this.service.enrollmentHistory(id);
  }

  @Get(':id/deletability')
  @RequirePermissions(Permission.STUDENT_MANAGE)
  @ApiOperation({ summary: 'Whether the student can be hard-deleted, and the blockers if not' })
  deletability(@Param('id') id: string) {
    return this.service.deletability(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.STUDENT_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.STUDENT_MANAGE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ----- Parent links ------------------------------------------------------
  @Post(':id/parents')
  @RequirePermissions(Permission.STUDENT_MANAGE)
  @ApiOperation({ summary: 'Link a parent to a student' })
  linkParent(@Param('id') id: string, @Body() dto: LinkParentDto) {
    return this.service.linkParent(id, dto);
  }

  @Get(':id/parents')
  @RequirePermissions(Permission.STUDENT_MANAGE)
  listParents(@Param('id') id: string) {
    return this.service.listParents(id);
  }

  @Delete(':id/parents/:parentId')
  @HttpCode(204)
  @RequirePermissions(Permission.STUDENT_MANAGE)
  unlinkParent(@Param('id') id: string, @Param('parentId') parentId: string) {
    return this.service.unlinkParent(id, parentId);
  }

  // ----- Vaccines ----------------------------------------------------------
  @Get(':id/vaccines')
  @RequirePermissions(Permission.STUDENT_MANAGE)
  @ApiOperation({ summary: 'List a student vaccination records' })
  listVaccines(@Param('id') id: string) {
    return this.service.listVaccines(id);
  }

  @Post(':id/vaccines')
  @RequirePermissions(Permission.STUDENT_MANAGE)
  @ApiOperation({ summary: 'Add a vaccination record to a student' })
  addVaccine(@Param('id') id: string, @Body() dto: CreateVaccineDto) {
    return this.service.addVaccine(id, dto);
  }

  @Patch(':id/vaccines/:vaccineId')
  @RequirePermissions(Permission.STUDENT_MANAGE)
  updateVaccine(
    @Param('id') id: string,
    @Param('vaccineId') vaccineId: string,
    @Body() dto: UpdateVaccineDto,
  ) {
    return this.service.updateVaccine(id, vaccineId, dto);
  }

  @Delete(':id/vaccines/:vaccineId')
  @HttpCode(204)
  @RequirePermissions(Permission.STUDENT_MANAGE)
  removeVaccine(@Param('id') id: string, @Param('vaccineId') vaccineId: string) {
    return this.service.removeVaccine(id, vaccineId);
  }
}
