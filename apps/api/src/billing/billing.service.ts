import { Injectable } from '@nestjs/common';
import { BillingRepository } from './billing.repository';
import { WebhookService, WebhookEvent } from '../webhooks/webhook.service';
import type {
  AddPaymentMethodDto,
  AddBillingContactDto,
  CreateInvoiceDto,
  CreateRefundDto,
  RecordPaymentDto,
} from './billing.dto';

/**
 * Platform billing domain (Munaxa → school): invoices, payments, refunds, payment methods, billing
 * contacts and tax. Owns everything commercial-financial; the Subscription plane stays responsible
 * only for entitlement resolution (clean domain boundary). Payment outcomes fan out as webhooks.
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly repo: BillingRepository,
    private readonly webhooks: WebhookService,
  ) {}

  listInvoices(tenantId: string) {
    return this.repo.listInvoices(tenantId);
  }

  getInvoice(id: string) {
    return this.repo.getInvoice(id);
  }

  /** Create an invoice; tax is computed from the tenant's country tax rate (BillingTaxRate). */
  async createInvoice(tenantId: string, dto: CreateInvoiceDto) {
    const taxRateBps = dto.countryCode ? await this.repo.taxRateFor(dto.countryCode) : 0;
    return this.repo.createInvoice(tenantId, {
      number: dto.number,
      currency: dto.currency ?? 'JOD',
      lines: dto.lines,
      taxRateBps,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      periodStart: dto.periodStart ? new Date(dto.periodStart) : null,
      periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : null,
      notes: dto.notes ?? null,
    });
  }

  issueInvoice(id: string) {
    return this.repo.setInvoiceStatus(id, 'OPEN');
  }

  voidInvoice(id: string) {
    return this.repo.setInvoiceStatus(id, 'VOID');
  }

  listPayments(tenantId: string) {
    return this.repo.listPayments(tenantId);
  }

  /** Record a payment; a completed/failed payment fans out as a webhook. */
  async recordPayment(tenantId: string, dto: RecordPaymentDto) {
    const payment = await this.repo.recordPayment(tenantId, {
      invoiceId: dto.invoiceId ?? null,
      provider: dto.provider,
      amount: dto.amount,
      currency: dto.currency ?? 'JOD',
      status: dto.status,
      externalRef: dto.externalRef ?? null,
      failureReason: dto.failureReason ?? null,
    });
    if (dto.status === 'COMPLETED') {
      await this.webhooks.publish(WebhookEvent.PAYMENT_COMPLETED, {
        tenantId,
        data: { paymentId: payment.id, amount: payment.amount },
      });
    } else if (dto.status === 'FAILED') {
      await this.webhooks.publish(WebhookEvent.PAYMENT_FAILED, {
        tenantId,
        data: { paymentId: payment.id, amount: payment.amount, reason: dto.failureReason ?? null },
      });
    }
    return payment;
  }

  createRefund(tenantId: string, dto: CreateRefundDto) {
    return this.repo.createRefund(tenantId, dto.paymentId, dto.amount, dto.reason ?? null);
  }

  listPaymentMethods(tenantId: string) {
    return this.repo.listPaymentMethods(tenantId);
  }

  addPaymentMethod(tenantId: string, dto: AddPaymentMethodDto) {
    return this.repo.addPaymentMethod(tenantId, dto);
  }

  removePaymentMethod(id: string) {
    return this.repo.removePaymentMethod(id);
  }

  listContacts(tenantId: string) {
    return this.repo.listContacts(tenantId);
  }

  addContact(tenantId: string, dto: AddBillingContactDto) {
    return this.repo.addContact(tenantId, dto);
  }
}
