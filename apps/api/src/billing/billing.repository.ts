import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { withPlatform, type TxClient } from '../prisma/tenant.helpers';
import { TenantContextStore } from '../prisma/tenant-context';

/**
 * Control-plane data access for platform billing (Munaxa → school), distinct from school finance
 * (school → parent). Cross-tenant via `withPlatform`; every mutation writes an audit row in the
 * same transaction (doc 10).
 */
@Injectable()
export class BillingRepository {
  constructor(private readonly prisma: PrismaService) {}

  private audit(
    tx: TxClient,
    params: {
      tenantId: string;
      action: string;
      entityType: string;
      entityId?: string | null;
      metadata?: Prisma.InputJsonValue;
    },
  ): Promise<unknown> {
    return tx.auditLog.create({
      data: {
        tenantId: params.tenantId,
        actorUserId: TenantContextStore.get()?.actorUserId ?? null,
        actorRole: 'platform',
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
      },
    });
  }

  // --- Invoices --------------------------------------------------------------

  listInvoices(tenantId: string) {
    return withPlatform(this.prisma, (tx) =>
      tx.billingInvoice.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        include: { lines: true, payments: true },
      }),
    );
  }

  getInvoice(id: string) {
    return withPlatform(this.prisma, (tx) =>
      tx.billingInvoice.findUnique({ where: { id }, include: { lines: true, payments: true } }),
    );
  }

  createInvoice(
    tenantId: string,
    data: {
      number: string;
      currency: string;
      lines: Array<{ description: string; quantity: number; unitAmount: number }>;
      taxRateBps: number;
      dueDate?: Date | null;
      periodStart?: Date | null;
      periodEnd?: Date | null;
      notes?: string | null;
    },
  ) {
    return withPlatform(this.prisma, async (tx) => {
      const subtotal = data.lines.reduce((sum, l) => sum + l.quantity * l.unitAmount, 0);
      const taxAmount = Math.round((subtotal * data.taxRateBps) / 10_000);
      const invoice = await tx.billingInvoice.create({
        data: {
          tenantId,
          number: data.number,
          currency: data.currency,
          subtotal,
          taxAmount,
          total: subtotal + taxAmount,
          dueDate: data.dueDate ?? null,
          periodStart: data.periodStart ?? null,
          periodEnd: data.periodEnd ?? null,
          notes: data.notes ?? null,
          lines: {
            create: data.lines.map((l) => ({
              description: l.description,
              quantity: l.quantity,
              unitAmount: l.unitAmount,
              amount: l.quantity * l.unitAmount,
            })),
          },
        },
        include: { lines: true },
      });
      await this.audit(tx, {
        tenantId,
        action: 'platform.billing.invoice.create',
        entityType: 'BillingInvoice',
        entityId: invoice.id,
        metadata: { number: invoice.number, total: invoice.total },
      });
      return invoice;
    });
  }

  setInvoiceStatus(id: string, status: string) {
    return withPlatform(this.prisma, async (tx) => {
      const invoice = await tx.billingInvoice.update({
        where: { id },
        data: {
          status: status as never,
          ...(status === 'OPEN' ? { issuedAt: new Date() } : {}),
          ...(status === 'PAID' ? { paidAt: new Date() } : {}),
        },
      });
      await this.audit(tx, {
        tenantId: invoice.tenantId,
        action: 'platform.billing.invoice.status',
        entityType: 'BillingInvoice',
        entityId: id,
        metadata: { status },
      });
      return invoice;
    });
  }

  // --- Payments & refunds ----------------------------------------------------

  listPayments(tenantId: string) {
    return withPlatform(this.prisma, (tx) =>
      tx.billingPayment.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        include: { refunds: true },
      }),
    );
  }

  recordPayment(
    tenantId: string,
    data: {
      invoiceId?: string | null;
      provider: string;
      amount: number;
      currency: string;
      status: string;
      externalRef?: string | null;
      failureReason?: string | null;
    },
  ) {
    return withPlatform(this.prisma, async (tx) => {
      const payment = await tx.billingPayment.create({
        data: {
          tenantId,
          invoiceId: data.invoiceId ?? null,
          provider: data.provider as never,
          amount: data.amount,
          currency: data.currency,
          status: data.status as never,
          externalRef: data.externalRef ?? null,
          failureReason: data.failureReason ?? null,
          ...(data.status === 'COMPLETED' ? { paidAt: new Date() } : {}),
        },
      });
      // Mark a linked invoice paid when the payment completes.
      if (data.status === 'COMPLETED' && data.invoiceId) {
        await tx.billingInvoice.update({
          where: { id: data.invoiceId },
          data: { status: 'PAID', paidAt: new Date() },
        });
      }
      await this.audit(tx, {
        tenantId,
        action: 'platform.billing.payment.record',
        entityType: 'BillingPayment',
        entityId: payment.id,
        metadata: { amount: payment.amount, status: payment.status },
      });
      return payment;
    });
  }

  createRefund(tenantId: string, paymentId: string, amount: number, reason?: string | null) {
    return withPlatform(this.prisma, async (tx) => {
      const refund = await tx.billingRefund.create({
        data: { tenantId, paymentId, amount, reason: reason ?? null },
      });
      await tx.billingPayment.update({ where: { id: paymentId }, data: { status: 'REFUNDED' } });
      await this.audit(tx, {
        tenantId,
        action: 'platform.billing.refund',
        entityType: 'BillingRefund',
        entityId: refund.id,
        metadata: { paymentId, amount },
      });
      return refund;
    });
  }

  // --- Payment methods & contacts -------------------------------------------

  listPaymentMethods(tenantId: string) {
    return withPlatform(this.prisma, (tx) =>
      tx.billingPaymentMethod.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } }),
    );
  }

  addPaymentMethod(
    tenantId: string,
    data: Omit<Prisma.BillingPaymentMethodUncheckedCreateInput, 'tenantId'>,
  ) {
    return withPlatform(this.prisma, (tx) =>
      tx.billingPaymentMethod.create({ data: { tenantId, ...data } }),
    );
  }

  removePaymentMethod(id: string) {
    return withPlatform(this.prisma, (tx) => tx.billingPaymentMethod.delete({ where: { id } }));
  }

  listContacts(tenantId: string) {
    return withPlatform(this.prisma, (tx) =>
      tx.billingContact.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } }),
    );
  }

  addContact(tenantId: string, data: Omit<Prisma.BillingContactUncheckedCreateInput, 'tenantId'>) {
    return withPlatform(this.prisma, (tx) =>
      tx.billingContact.create({ data: { tenantId, ...data } }),
    );
  }

  // --- Tax -------------------------------------------------------------------

  taxRateFor(countryCode: string): Promise<number> {
    return withPlatform(this.prisma, async (tx) => {
      const rate = await tx.billingTaxRate.findFirst({
        where: { countryCode, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      return rate?.rateBps ?? 0;
    });
  }
}
