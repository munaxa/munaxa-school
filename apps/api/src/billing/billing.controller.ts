import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { BillingService } from './billing.service';
import {
  AddBillingContactDto,
  AddPaymentMethodDto,
  CreateInvoiceDto,
  CreateRefundDto,
  RecordPaymentDto,
} from './billing.dto';

/**
 * Platform Console — Billing (Munaxa → school). Cross-tenant, gated by platform billing
 * permissions, fully audited. Distinct from the school-finance module (school → parent).
 */
@ApiTags('platform-billing')
@ApiBearerAuth()
@Controller({ path: 'platform/console/schools/:tenantId/billing', version: '1' })
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get('invoices')
  @RequirePermissions(Permission.PLATFORM_BILLING_READ)
  @ApiOperation({ summary: 'List a school billing invoices' })
  invoices(@Param('tenantId') tenantId: string) {
    return this.service.listInvoices(tenantId);
  }

  @Post('invoices')
  @RequirePermissions(Permission.PLATFORM_BILLING_MANAGE)
  @ApiOperation({ summary: 'Create an invoice (tax computed from the country rate)' })
  createInvoice(@Param('tenantId') tenantId: string, @Body() dto: CreateInvoiceDto) {
    return this.service.createInvoice(tenantId, dto);
  }

  @Post('invoices/:id/issue')
  @RequirePermissions(Permission.PLATFORM_BILLING_MANAGE)
  @ApiOperation({ summary: 'Issue (open) an invoice' })
  issue(@Param('id') id: string) {
    return this.service.issueInvoice(id);
  }

  @Post('invoices/:id/void')
  @RequirePermissions(Permission.PLATFORM_BILLING_MANAGE)
  @ApiOperation({ summary: 'Void an invoice' })
  void(@Param('id') id: string) {
    return this.service.voidInvoice(id);
  }

  @Get('payments')
  @RequirePermissions(Permission.PLATFORM_BILLING_READ)
  @ApiOperation({ summary: 'Payment history for a school' })
  payments(@Param('tenantId') tenantId: string) {
    return this.service.listPayments(tenantId);
  }

  @Post('payments')
  @RequirePermissions(Permission.PLATFORM_BILLING_MANAGE)
  @ApiOperation({ summary: 'Record a payment (completed/failed fans out a webhook)' })
  recordPayment(@Param('tenantId') tenantId: string, @Body() dto: RecordPaymentDto) {
    return this.service.recordPayment(tenantId, dto);
  }

  @Post('refunds')
  @RequirePermissions(Permission.PLATFORM_BILLING_MANAGE)
  @ApiOperation({ summary: 'Refund a payment' })
  refund(@Param('tenantId') tenantId: string, @Body() dto: CreateRefundDto) {
    return this.service.createRefund(tenantId, dto);
  }

  @Get('payment-methods')
  @RequirePermissions(Permission.PLATFORM_BILLING_READ)
  @ApiOperation({ summary: 'List stored payment methods' })
  paymentMethods(@Param('tenantId') tenantId: string) {
    return this.service.listPaymentMethods(tenantId);
  }

  @Post('payment-methods')
  @RequirePermissions(Permission.PLATFORM_BILLING_MANAGE)
  @ApiOperation({ summary: 'Add a payment method (tokenized reference)' })
  addPaymentMethod(@Param('tenantId') tenantId: string, @Body() dto: AddPaymentMethodDto) {
    return this.service.addPaymentMethod(tenantId, dto);
  }

  @Delete('payment-methods/:id')
  @RequirePermissions(Permission.PLATFORM_BILLING_MANAGE)
  @ApiOperation({ summary: 'Remove a payment method' })
  removePaymentMethod(@Param('id') id: string) {
    return this.service.removePaymentMethod(id);
  }

  @Get('contacts')
  @RequirePermissions(Permission.PLATFORM_BILLING_READ)
  @ApiOperation({ summary: 'List billing contacts' })
  contacts(@Param('tenantId') tenantId: string) {
    return this.service.listContacts(tenantId);
  }

  @Post('contacts')
  @RequirePermissions(Permission.PLATFORM_BILLING_MANAGE)
  @ApiOperation({ summary: 'Add a billing contact' })
  addContact(@Param('tenantId') tenantId: string, @Body() dto: AddBillingContactDto) {
    return this.service.addContact(tenantId, dto);
  }
}
