import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { TrainingService } from './training.service';
import {
  CreateTrainingCourseDto,
  EnrollTrainingDto,
  ExpiringTrainingQueryDto,
  UpdateTrainingCourseDto,
  UpdateTrainingRecordDto,
} from './training.dto';

/** Training catalog + record management and the expiring-certifications report. */
@ApiTags('training')
@ApiBearerAuth()
@Controller({ path: 'hr', version: '1' })
export class TrainingController {
  constructor(private readonly service: TrainingService) {}

  // ----- Courses -------------------------------------------------------------
  @Get('training-courses')
  @RequirePermissions(Permission.TRAINING_READ)
  listCourses() {
    return this.service.listCourses();
  }

  @Post('training-courses')
  @RequirePermissions(Permission.TRAINING_MANAGE)
  createCourse(@Body() dto: CreateTrainingCourseDto) {
    return this.service.createCourse(dto);
  }

  @Patch('training-courses/:id')
  @RequirePermissions(Permission.TRAINING_MANAGE)
  updateCourse(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTrainingCourseDto) {
    return this.service.updateCourse(id, dto);
  }

  @Delete('training-courses/:id')
  @HttpCode(204)
  @RequirePermissions(Permission.TRAINING_MANAGE)
  removeCourse(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeCourse(id);
  }

  // ----- Records -------------------------------------------------------------
  @Get('training-records/expiring')
  @RequirePermissions(Permission.TRAINING_READ)
  expiring(@Query() query: ExpiringTrainingQueryDto) {
    return this.service.expiring(query.within ?? 90);
  }

  @Patch('training-records/:id')
  @RequirePermissions(Permission.TRAINING_MANAGE)
  updateRecord(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTrainingRecordDto) {
    return this.service.updateRecord(id, dto);
  }

  @Delete('training-records/:id')
  @HttpCode(204)
  @RequirePermissions(Permission.TRAINING_MANAGE)
  removeRecord(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeRecord(id);
  }
}

/** Employee-scoped training records (list + enrol). */
@ApiTags('training')
@ApiBearerAuth()
@Controller({ path: 'employees/:employeeId/training-records', version: '1' })
export class EmployeeTrainingController {
  constructor(private readonly service: TrainingService) {}

  @Get()
  @RequirePermissions(Permission.TRAINING_READ)
  list(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.service.listForEmployee(employeeId);
  }

  @Post()
  @RequirePermissions(Permission.TRAINING_MANAGE)
  enroll(@Param('employeeId', ParseUUIDPipe) employeeId: string, @Body() dto: EnrollTrainingDto) {
    return this.service.enroll(employeeId, dto);
  }
}
