import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ChargeService } from './charge.service';
import { CreateChargeDto, CreatePlanDto, RescheduleInstallmentDto } from './charge.dto';

@ApiTags('finance')
@ApiBearerAuth()
@Controller({ path: 'finance', version: '1' })
export class ChargeController {
  constructor(private readonly service: ChargeService) {}

  @Post('charges')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  @ApiOperation({ summary: 'Create a charge (financial obligation)' })
  create(@Body() dto: CreateChargeDto) {
    return this.service.create(dto);
  }

  @Post('charges/:id/plan')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  @ApiOperation({ summary: 'Create or replace the payment plan for a charge (schedule its net)' })
  createPlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreatePlanDto) {
    return this.service.createPlan(id, dto);
  }

  @Post('charges/:id/cancel')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.cancel(id);
  }

  @Patch('installments/:id')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  @ApiOperation({ summary: 'Reschedule an installment (due date / amount); keeps Σ == charge net' })
  reschedule(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RescheduleInstallmentDto) {
    return this.service.reschedule(id, dto);
  }

  @Get('charges')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiQuery({ name: 'studentId', required: true })
  @ApiOperation({ summary: 'Charges (obligation → plan → installments) for a student' })
  list(@Query('studentId') studentId: string) {
    return this.service.listForStudent(studentId);
  }
}
