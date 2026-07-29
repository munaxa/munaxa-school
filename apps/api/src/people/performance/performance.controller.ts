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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { PerformanceService } from './performance.service';
import {
  CreatePerformanceCycleDto,
  CreatePerformanceGoalDto,
  CreatePerformanceReviewDto,
  UpdatePerformanceCycleDto,
  UpdatePerformanceGoalDto,
  UpdatePerformanceReviewDto,
} from './performance.dto';

/** Performance cycles, review lifecycle, and goals. */
@ApiTags('performance')
@ApiBearerAuth()
@Controller({ path: 'hr', version: '1' })
export class PerformanceController {
  constructor(private readonly service: PerformanceService) {}

  // ----- Cycles --------------------------------------------------------------
  @Get('performance-cycles')
  @RequirePermissions(Permission.PERFORMANCE_READ)
  listCycles() {
    return this.service.listCycles();
  }

  @Post('performance-cycles')
  @RequirePermissions(Permission.PERFORMANCE_MANAGE)
  createCycle(@Body() dto: CreatePerformanceCycleDto) {
    return this.service.createCycle(dto);
  }

  @Patch('performance-cycles/:id')
  @RequirePermissions(Permission.PERFORMANCE_MANAGE)
  updateCycle(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePerformanceCycleDto) {
    return this.service.updateCycle(id, dto);
  }

  @Delete('performance-cycles/:id')
  @HttpCode(204)
  @RequirePermissions(Permission.PERFORMANCE_MANAGE)
  removeCycle(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeCycle(id);
  }

  // ----- Reviews -------------------------------------------------------------
  @Get('performance-reviews/:id')
  @RequirePermissions(Permission.PERFORMANCE_READ)
  getReview(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getReview(id);
  }

  @Patch('performance-reviews/:id')
  @RequirePermissions(Permission.PERFORMANCE_MANAGE)
  updateReview(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePerformanceReviewDto) {
    return this.service.updateReview(id, dto);
  }

  @Post('performance-reviews/:id/submit')
  @RequirePermissions(Permission.PERFORMANCE_MANAGE)
  submitReview(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.submitReview(id);
  }

  @Post('performance-reviews/:id/acknowledge')
  @RequirePermissions(Permission.PERFORMANCE_READ)
  acknowledgeReview(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.acknowledgeReview(id);
  }

  // ----- Goals ---------------------------------------------------------------
  @Post('performance-reviews/:id/goals')
  @RequirePermissions(Permission.PERFORMANCE_MANAGE)
  createGoal(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreatePerformanceGoalDto) {
    return this.service.createGoal(id, dto);
  }

  @Patch('performance-goals/:id')
  @RequirePermissions(Permission.PERFORMANCE_MANAGE)
  updateGoal(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePerformanceGoalDto) {
    return this.service.updateGoal(id, dto);
  }

  @Delete('performance-goals/:id')
  @HttpCode(204)
  @RequirePermissions(Permission.PERFORMANCE_MANAGE)
  removeGoal(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeGoal(id);
  }
}

/** Employee-scoped review list + creation. */
@ApiTags('performance')
@ApiBearerAuth()
@Controller({ path: 'employees/:employeeId', version: '1' })
export class EmployeePerformanceController {
  constructor(private readonly service: PerformanceService) {}

  @Get('performance-reviews')
  @RequirePermissions(Permission.PERFORMANCE_READ)
  list(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.service.listReviews(employeeId);
  }

  @Post('performance-reviews')
  @RequirePermissions(Permission.PERFORMANCE_MANAGE)
  create(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreatePerformanceReviewDto,
  ) {
    return this.service.createReview(employeeId, dto);
  }
}
