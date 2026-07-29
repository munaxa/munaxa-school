import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { PaymentService } from './payment.service';
import {
  CreateFinancialAccountPaymentDto,
  CreatePaymentDto,
  PresignReceiptDto,
  RejectPaymentDto,
} from './payment.dto';

@ApiTags('finance')
@ApiBearerAuth()
@Controller({ path: 'finance/payments', version: '1' })
export class PaymentController {
  constructor(private readonly service: PaymentService) {}

  @Post('receipt/presign')
  @HttpCode(200)
  @RequirePermissions(Permission.RECEIPT_UPLOAD)
  @ApiOperation({ summary: 'Pre-signed S3 URL to upload a CliQ/e-wallet receipt' })
  presign(@Body() dto: PresignReceiptDto) {
    return this.service.presignReceipt(dto);
  }

  @Post()
  @RequirePermissions(Permission.RECEIPT_UPLOAD)
  @ApiOperation({ summary: 'Record a payment (PENDING until verified)' })
  create(@Body() dto: CreatePaymentDto) {
    return this.service.create(dto);
  }

  @Post(':id/verify')
  @HttpCode(200)
  @RequirePermissions(Permission.FINANCE_MANAGE)
  @ApiOperation({ summary: 'Verify a pending payment; auto-allocates to installments (audited)' })
  verify(@Param('id') id: string) {
    return this.service.verify(id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions(Permission.FINANCE_MANAGE)
  @ApiOperation({ summary: 'Reject a pending payment (audited)' })
  reject(@Param('id') id: string, @Body() dto: RejectPaymentDto) {
    return this.service.reject(id, dto);
  }

  @Post(':id/notify-parent')
  @HttpCode(200)
  @RequirePermissions(Permission.FINANCE_MANAGE)
  @ApiOperation({ summary: 'Email the parent that a settled payment was received (records it)' })
  notifyParent(@Param('id') id: string) {
    return this.service.notifyParent(id);
  }

  @Get()
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiQuery({ name: 'studentId', required: true })
  list(@Query('studentId') studentId: string) {
    return this.service.listForStudent(studentId);
  }

  @Post('family/:financialAccountId')
  @RequirePermissions(Permission.RECEIPT_UPLOAD)
  @ApiOperation({
    summary:
      'Record a single family payment against a financial account (auto-allocated on verify)',
  })
  createForFamily(
    @Param('financialAccountId') financialAccountId: string,
    @Body() dto: CreateFinancialAccountPaymentDto,
  ) {
    return this.service.createForFinancialAccount(financialAccountId, dto);
  }

  @Get('family/:financialAccountId')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({ summary: 'Family payment history for a financial account' })
  listForFamily(@Param('financialAccountId') financialAccountId: string) {
    return this.service.listForFinancialAccount(financialAccountId);
  }
}
