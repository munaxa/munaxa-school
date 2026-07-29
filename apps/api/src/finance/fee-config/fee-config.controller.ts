import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { FeeConfigService } from './fee-config.service';
import {
  ApplyDiscountRuleDto,
  CreateDiscountRuleDto,
  CreateGradeFeeScheduleDto,
  CreateTransportFareDto,
  UpdateDiscountRuleDto,
  UpdateGradeFeeScheduleDto,
  UpdateTransportFareDto,
  UpsertBillingPolicyDto,
} from './fee-config.dto';

/**
 * Enrollment & billing configuration (Phase 1): grade fee schedules, transport fares,
 * discount rules, and the per-tenant billing policy. Reuses the finance read/manage
 * permissions; consumed by the enrollment quote/charge flows in later phases.
 */
@ApiTags('finance')
@ApiBearerAuth()
@Controller({ path: 'finance/fee-config', version: '1' })
export class FeeConfigController {
  constructor(private readonly service: FeeConfigService) {}

  // Grade fee schedules
  @Get('grade-fees')
  @RequirePermissions(Permission.FINANCE_READ)
  listGradeFees(@Query('academicYearId') academicYearId?: string) {
    return this.service.listGradeFees(academicYearId);
  }
  @Post('grade-fees')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  createGradeFee(@Body() dto: CreateGradeFeeScheduleDto) {
    return this.service.createGradeFee(dto);
  }
  @Patch('grade-fees/:id')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  updateGradeFee(@Param('id') id: string, @Body() dto: UpdateGradeFeeScheduleDto) {
    return this.service.updateGradeFee(id, dto);
  }

  // Transport fares
  @Get('transport-fares')
  @RequirePermissions(Permission.FINANCE_READ)
  listTransportFares(@Query('academicYearId') academicYearId?: string) {
    return this.service.listTransportFares(academicYearId);
  }
  @Post('transport-fares')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  createTransportFare(@Body() dto: CreateTransportFareDto) {
    return this.service.createTransportFare(dto);
  }
  @Patch('transport-fares/:id')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  updateTransportFare(@Param('id') id: string, @Body() dto: UpdateTransportFareDto) {
    return this.service.updateTransportFare(id, dto);
  }
  @Delete('transport-fares/:id')
  @HttpCode(204)
  @RequirePermissions(Permission.FINANCE_MANAGE)
  deleteTransportFare(@Param('id') id: string) {
    return this.service.deleteTransportFare(id);
  }

  // Discount rules
  @Get('discount-rules')
  @RequirePermissions(Permission.FINANCE_READ)
  listDiscountRules() {
    return this.service.listDiscountRules();
  }
  @Post('discount-rules')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  createDiscountRule(@Body() dto: CreateDiscountRuleDto) {
    return this.service.createDiscountRule(dto);
  }
  @Patch('discount-rules/:id')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  updateDiscountRule(@Param('id') id: string, @Body() dto: UpdateDiscountRuleDto) {
    return this.service.updateDiscountRule(id, dto);
  }
  @Post('discount-rules/:id/apply')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  applyDiscountRule(@Param('id') id: string, @Body() dto: ApplyDiscountRuleDto) {
    return this.service.applyRule(id, dto);
  }

  // Billing policy (singleton)
  @Get('policy')
  @RequirePermissions(Permission.FINANCE_READ)
  getPolicy() {
    return this.service.getPolicy();
  }
  @Put('policy')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  upsertPolicy(@Body() dto: UpsertBillingPolicyDto) {
    return this.service.upsertPolicy(dto);
  }
}
