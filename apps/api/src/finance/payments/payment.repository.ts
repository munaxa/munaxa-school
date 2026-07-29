import { Injectable } from '@nestjs/common';
import { Prisma, type Payment } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantConnectionManager } from '../../prisma/tenant-connection.service';
import { TenantContextStore } from '../../prisma/tenant-context';
import { AccountRepository } from '../account/account.repository';

/** A payment enriched for the statement: who recorded it + its linked JoFotara document. */
export interface DetailedPayment extends Payment {
  recordedByName: string | null;
  einvoice: { invoiceNumber: string; status: string; docType: string } | null;
}

@Injectable()
export class PaymentRepository extends TenantRepository {
  constructor(
    prisma: PrismaService,
    connections: TenantConnectionManager,
    private readonly accounts: AccountRepository,
  ) {
    super(prisma, connections);
  }

  private actor(): string | null {
    return TenantContextStore.get()?.actorUserId ?? null;
  }

  /** Record a payment (PENDING) against the student's account (money received, BR-17). */
  create(data: {
    studentId: string;
    amount: number;
    method: Payment['method'];
    reference: string | null;
    receiptKey: string | null;
    note: string | null;
  }): Promise<Payment> {
    return this.run(async (tx, tenantId) => {
      const account = await this.accounts.ensureAccountTx(tx, tenantId, data.studentId);
      const payment = await tx.payment.create({
        data: {
          tenantId,
          accountId: account.id,
          studentId: data.studentId,
          payerId: account.payerId,
          amount: new Prisma.Decimal(data.amount),
          method: data.method,
          reference: data.reference,
          receiptKey: data.receiptKey,
          note: data.note,
          status: 'PENDING',
          recordedById: this.actor(),
        },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'finance.payment.create',
        entityType: 'Payment',
        entityId: payment.id,
        metadata: {
          studentId: payment.studentId,
          amount: payment.amount.toString(),
          method: payment.method,
        },
      });
      return payment;
    });
  }

  /**
   * Record a PENDING account-scoped payment against a Financial Account (Payer). The payment belongs
   * to the account (payerId + accountScoped=true); studentId/accountId stay populated with a
   * REPRESENTATIVE child for backward compatibility (both columns are NOT NULL and legacy readers
   * expect them), but allocation is driven by accountScoped — the ledger spreads the money across ALL
   * the account's students.
   */
  createForFinancialAccount(data: {
    payerId: string;
    amount: number;
    method: Payment['method'];
    reference: string | null;
    receiptKey: string | null;
    note: string | null;
  }): Promise<Payment> {
    return this.run(async (tx, tenantId) => {
      const account = await tx.payer.findFirst({
        where: { id: data.payerId },
        select: { id: true },
      });
      if (!account) throw new Error('Financial account not found');
      // A representative student AR account is required for the NOT-NULL accountId/studentId columns.
      const repAccount = await tx.studentFinancialAccount.findFirst({
        where: { payerId: data.payerId },
        orderBy: { openedAt: 'asc' },
        select: { id: true, studentId: true },
      });
      if (!repAccount) {
        throw new Error('Financial account has no linked student to record the payment against');
      }
      const payment = await tx.payment.create({
        data: {
          tenantId,
          accountId: repAccount.id,
          studentId: repAccount.studentId,
          payerId: data.payerId,
          accountScoped: true,
          amount: new Prisma.Decimal(data.amount),
          method: data.method,
          reference: data.reference,
          receiptKey: data.receiptKey,
          note: data.note,
          status: 'PENDING',
          recordedById: this.actor(),
        },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'finance.payment.create',
        entityType: 'Payment',
        entityId: payment.id,
        metadata: {
          payerId: data.payerId,
          amount: payment.amount.toString(),
          method: payment.method,
        },
      });
      return payment;
    });
  }

  /** Payments recorded against a financial account (account payment history). */
  findByFinancialAccount(payerId: string): Promise<Payment[]> {
    return this.run((tx) =>
      tx.payment.findMany({
        where: { payerId, accountScoped: true },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  financialAccountExists(payerId: string): Promise<boolean> {
    return this.run(async (tx) => (await tx.payer.findFirst({ where: { id: payerId } })) !== null);
  }

  /**
   * Set a PENDING payment to VERIFIED or REJECTED. On VERIFY, allocate the gapless per-tenant
   * receipt number from the row-locked PaymentReceiptCounter in the same transaction (BR-18, MT-3).
   */
  setStatus(id: string, status: 'VERIFIED' | 'REJECTED', note?: string): Promise<Payment> {
    return this.run(async (tx, tenantId) => {
      let receiptNo: number | undefined;
      if (status === 'VERIFIED') {
        await tx.$executeRaw`INSERT INTO "PaymentReceiptCounter" ("id","tenantId") VALUES (gen_random_uuid(), ${tenantId}::uuid) ON CONFLICT ("tenantId") DO NOTHING`;
        const rows = await tx.$queryRaw<{ next: number }[]>`
          UPDATE "PaymentReceiptCounter" SET "nextReceiptNo" = "nextReceiptNo" + 1
          WHERE "tenantId" = ${tenantId}::uuid
          RETURNING "nextReceiptNo" - 1 AS "next"`;
        receiptNo = rows[0]!.next;
      }
      const payment = await tx.payment.update({
        where: { id },
        data: {
          status,
          verifiedById: this.actor(),
          verifiedAt: new Date(),
          ...(receiptNo !== undefined ? { receiptNo } : {}),
          ...(note !== undefined ? { note } : {}),
        },
      });
      await this.writeAudit(tx, tenantId, {
        action: status === 'VERIFIED' ? 'finance.payment.verify' : 'finance.payment.reject',
        entityType: 'Payment',
        entityId: payment.id,
        metadata: { amount: payment.amount.toString(), status },
      });
      return payment;
    });
  }

  findByStudent(studentId: string): Promise<Payment[]> {
    return this.run((tx) =>
      tx.payment.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' } }),
    );
  }

  findDetailedByStudent(studentId: string): Promise<DetailedPayment[]> {
    return this.run(async (tx) => {
      const payments = await tx.payment.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        include: {
          einvoiceDocuments: {
            select: { invoiceNumber: true, status: true, docType: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
      const recordedIds = [
        ...new Set(payments.map((p) => p.recordedById).filter(Boolean)),
      ] as string[];
      const users = recordedIds.length
        ? await tx.user.findMany({
            where: { id: { in: recordedIds } },
            select: { id: true, firstNameEn: true, lastNameEn: true, email: true },
          })
        : [];
      const nameById = new Map(
        users.map((u) => [
          u.id,
          [u.firstNameEn, u.lastNameEn].filter(Boolean).join(' ').trim() || u.email,
        ]),
      );
      return payments.map(({ einvoiceDocuments, ...p }) => ({
        ...p,
        recordedByName: p.recordedById ? (nameById.get(p.recordedById) ?? null) : null,
        einvoice: einvoiceDocuments[0]
          ? {
              invoiceNumber: einvoiceDocuments[0].invoiceNumber,
              status: einvoiceDocuments[0].status,
              docType: einvoiceDocuments[0].docType,
            }
          : null,
      }));
    });
  }

  /** Account payment history enriched like findDetailedByStudent (statement drill-down). */
  findDetailedByFinancialAccount(payerId: string): Promise<DetailedPayment[]> {
    return this.run(async (tx) => {
      const payments = await tx.payment.findMany({
        where: { payerId, accountScoped: true },
        orderBy: { createdAt: 'desc' },
        include: {
          einvoiceDocuments: {
            select: { invoiceNumber: true, status: true, docType: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
      const recordedIds = [
        ...new Set(payments.map((p) => p.recordedById).filter(Boolean)),
      ] as string[];
      const users = recordedIds.length
        ? await tx.user.findMany({
            where: { id: { in: recordedIds } },
            select: { id: true, firstNameEn: true, lastNameEn: true, email: true },
          })
        : [];
      const nameById = new Map(
        users.map((u) => [
          u.id,
          [u.firstNameEn, u.lastNameEn].filter(Boolean).join(' ').trim() || u.email,
        ]),
      );
      return payments.map(({ einvoiceDocuments, ...p }) => ({
        ...p,
        recordedByName: p.recordedById ? (nameById.get(p.recordedById) ?? null) : null,
        einvoice: einvoiceDocuments[0]
          ? {
              invoiceNumber: einvoiceDocuments[0].invoiceNumber,
              status: einvoiceDocuments[0].status,
              docType: einvoiceDocuments[0].docType,
            }
          : null,
      }));
    });
  }

  findById(id: string): Promise<Payment | null> {
    return this.run((tx) => tx.payment.findFirst({ where: { id } }));
  }

  studentNotifyContact(
    studentId: string,
  ): Promise<{ studentNameEn: string; parentEmail: string | null }> {
    return this.run(async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId },
        select: {
          firstNameEn: true,
          lastNameEn: true,
          parentLinks: {
            orderBy: { isPrimary: 'desc' },
            select: { parent: { select: { email: true } } },
          },
        },
      });
      const studentNameEn = student ? `${student.firstNameEn} ${student.lastNameEn}`.trim() : '';
      const parentEmail = student?.parentLinks.map((l) => l.parent.email).find(Boolean) ?? null;
      return { studentNameEn, parentEmail };
    });
  }

  tenantName(): Promise<string> {
    return this.run(async (tx, tenantId) => {
      const t = await tx.tenant.findFirst({ where: { id: tenantId }, select: { name: true } });
      return t?.name ?? 'School';
    });
  }

  financeSender(
    domain: string,
    fallbackFrom: string,
  ): Promise<{ from: string; replyTo: string | null }> {
    return this.run(async (tx, tenantId) => {
      const [tenant, settings] = await Promise.all([
        tx.tenant.findFirst({ where: { id: tenantId }, select: { name: true, slug: true } }),
        tx.notificationSettings.findUnique({ where: { tenantId } }),
      ]);
      if (!tenant) return { from: fallbackFrom, replyTo: settings?.replyToEmail ?? null };
      const emailOverridden = Boolean(
        settings && settings.senderEmail && settings.senderEmail !== 'notification@munaxa.com',
      );
      const nameCustom = Boolean(
        settings && settings.senderName && settings.senderName !== 'Munaxa Notifications',
      );
      const name = nameCustom ? settings!.senderName : tenant.name;
      // Finance/payment mail uses each school's own `<slug>.payments@<domain>` mailbox
      // (e.g. demo.payments@mail.munaxa.com), unless the tenant has explicitly overridden
      // the sender in NotificationSettings.
      const email = emailOverridden ? settings!.senderEmail : `${tenant.slug}.payments@${domain}`;
      return { from: `${name} <${email}>`, replyTo: settings?.replyToEmail ?? null };
    });
  }

  setParentNotified(id: string): Promise<Payment> {
    return this.run(async (tx, tenantId) => {
      const payment = await tx.payment.update({
        where: { id },
        data: { parentNotifiedAt: new Date() },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'finance.payment.notifyParent',
        entityType: 'Payment',
        entityId: payment.id,
        metadata: { studentId: payment.studentId },
      });
      return payment;
    });
  }

  studentExists(studentId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.student.findFirst({ where: { id: studentId, deletedAt: null } })) !== null,
    );
  }
}
