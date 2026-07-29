import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { LedgerService } from './ledger.service';
import { AllocatePaymentDto, ApplyAdjustmentDto, CreateRefundDto, RejectDto } from './ledger.dto';

/**
 * AR ledger endpoints: deductions, manual payment→installment allocation, credits and refunds.
 * All writes require `finance:manage`; reads fold into the statement.
 */
@ApiTags('finance')
@ApiBearerAuth()
@Controller({ path: 'finance/ledger', version: '1' })
export class LedgerController {
  constructor(private readonly service: LedgerService) {}

  @Post('adjustments')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  @ApiOperation({
    summary: 'Apply a deduction (discount/scholarship/waiver/write-off/credit-memo)',
  })
  applyAdjustment(@Body() dto: ApplyAdjustmentDto) {
    return this.service.applyAdjustment(dto);
  }

  @Post('adjustments/:id/reverse')
  @HttpCode(200)
  @RequirePermissions(Permission.FINANCE_MANAGE)
  reverseAdjustment(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.reverseAdjustment(id);
  }

  @Post('allocate')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  @ApiOperation({ summary: 'Apply a verified payment to one or more installments' })
  allocate(@Body() dto: AllocatePaymentDto) {
    return this.service.allocate(dto);
  }

  @Get('credits')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiQuery({ name: 'studentId', required: true })
  @ApiOperation({ summary: 'Credit lots (with remaining balance) for a student' })
  credits(@Query('studentId') studentId: string) {
    return this.service.listCredits(studentId);
  }

  @Post('refunds')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  @ApiOperation({ summary: 'Request a refund of available credit (PENDING → verify)' })
  createRefund(@Body() dto: CreateRefundDto) {
    return this.service.createRefund(dto);
  }

  @Post('refunds/:id/verify')
  @HttpCode(200)
  @RequirePermissions(Permission.FINANCE_MANAGE)
  verifyRefund(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.verifyRefund(id);
  }

  @Post('refunds/:id/reject')
  @HttpCode(200)
  @RequirePermissions(Permission.FINANCE_MANAGE)
  rejectRefund(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectDto) {
    return this.service.rejectRefund(id, dto.note);
  }
}
