import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { GradeService } from './grade.service';
import { CreateGradeDto, ImportGradesDto } from './grade.dto';

@ApiTags('grades')
@ApiBearerAuth()
@Controller({ path: 'grade-records', version: '1' })
export class GradeController {
  constructor(private readonly service: GradeService) {}

  @Post()
  @RequirePermissions(Permission.GRADE_IMPORT)
  create(@Body() dto: CreateGradeDto) {
    return this.service.create(dto);
  }

  @Post('import')
  @RequirePermissions(Permission.GRADE_IMPORT)
  @ApiOperation({ summary: 'Bulk-import grades from CSV (idempotent per assessment)' })
  import(@Body() dto: ImportGradesDto) {
    return this.service.importCsv(dto);
  }

  @Get()
  @RequirePermissions(Permission.GRADE_READ)
  @ApiQuery({ name: 'studentId', required: true })
  @ApiQuery({ name: 'semesterId', required: false })
  list(@Query('studentId') studentId: string, @Query('semesterId') semesterId?: string) {
    return this.service.list(studentId, semesterId);
  }

  @Get('students/:studentId/report')
  @RequirePermissions(Permission.GRADE_READ)
  @ApiQuery({ name: 'semesterId', required: false })
  @ApiOperation({ summary: 'Grade report (parent/student academic view)' })
  report(@Param('studentId') studentId: string, @Query('semesterId') semesterId?: string) {
    return this.service.report(studentId, semesterId);
  }
}
