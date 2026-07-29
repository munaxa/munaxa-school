import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Payment } from '@prisma/client';
import { PaymentRepository } from './payment.repository';
import { StorageService, type PresignedUpload } from '../../common/storage.service';
import { MailService } from '../../mail/mail.service';
import type { Env } from '../../config/env.validation';
import { requireTenantId } from '../../common/tenant.util';
import { LedgerService } from '../ledger/ledger.service';
import { FinanceDocumentsService } from '../../documents/finance-documents.service';
import { DocumentEngineService } from '../../documents/document-engine.service';
import { docNumber } from '../../documents/templates/util';
import type {
  CreateFinancialAccountPaymentDto,
  CreatePaymentDto,
  PresignReceiptDto,
  RejectPaymentDto,
} from './payment.dto';

/**
 * Payment context: recording money received (CliQ/e-wallet receipt upload → verify/reject),
 * gapless receipt numbering, and parent settlement notifications. On verify, the ledger
 * auto-allocates the money to the account's open installments FIFO (residue → over-payment
 * credit) — see LedgerService.allocateOnVerify (BR-17..24).
 */
@Injectable()
export class PaymentService {
  constructor(
    private readonly repo: PaymentRepository,
    private readonly storage: StorageService,
    private readonly ledger: LedgerService,
    private readonly mail: MailService,
    private readonly financeDocs: FinanceDocumentsService,
    private readonly documents: DocumentEngineService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  presignReceipt(dto: PresignReceiptDto): Promise<PresignedUpload> {
    const key = this.storage.buildKey(requireTenantId(), 'receipts', dto.fileName);
    return this.storage.presignUpload(key, dto.contentType, dto.size);
  }

  async create(dto: CreatePaymentDto): Promise<Payment> {
    if (!(await this.repo.studentExists(dto.studentId))) {
      throw new BadRequestException('Student not found in this tenant');
    }
    if ((dto.method === 'CLIQ' || dto.method === 'EWALLET') && !dto.receiptKey && !dto.reference) {
      throw new BadRequestException('CliQ/e-wallet payments require a receipt or a reference');
    }
    if (dto.receiptKey) this.storage.assertKeyInTenant(dto.receiptKey);
    return this.repo.create({
      studentId: dto.studentId,
      amount: dto.amount,
      method: dto.method,
      reference: dto.reference ?? null,
      receiptKey: dto.receiptKey ?? null,
      note: dto.note ?? null,
    });
  }

  /**
   * Record a single family/customer payment against a FinancialAccount (recorded once). On verify the
   * money is auto-allocated across ALL the account's students' open installments (cross-student FIFO)
   * and any residue banks to the family credit — see LedgerService.allocateOnVerify.
   */
  async createForFinancialAccount(
    financialAccountId: string,
    dto: CreateFinancialAccountPaymentDto,
  ): Promise<Payment> {
    if (!(await this.repo.financialAccountExists(financialAccountId))) {
      throw new BadRequestException('Financial account not found in this tenant');
    }
    if ((dto.method === 'CLIQ' || dto.method === 'EWALLET') && !dto.receiptKey && !dto.reference) {
      throw new BadRequestException('CliQ/e-wallet payments require a receipt or a reference');
    }
    if (dto.receiptKey) this.storage.assertKeyInTenant(dto.receiptKey);
    const payment = await this.repo.createForFinancialAccount({
      payerId: financialAccountId,
      amount: dto.amount,
      method: dto.method,
      reference: dto.reference ?? null,
      receiptKey: dto.receiptKey ?? null,
      note: dto.note ?? null,
    });
    // Money received at the desk settles immediately: verify (assigns the official receipt number)
    // and allocate. MANUAL → apply exactly the officer's lines; AUTOMATIC → cross-student FIFO. Any
    // residue banks to the account credit either way.
    const verified = await this.repo.setStatus(payment.id, 'VERIFIED');
    if (dto.allocations && dto.allocations.length > 0) {
      await this.ledger.allocateManualOnVerify(verified, dto.allocations);
    } else {
      await this.ledger.allocateOnVerify(verified);
    }
    return verified;
  }

  listForFinancialAccount(financialAccountId: string): Promise<Payment[]> {
    return this.repo.findByFinancialAccount(financialAccountId);
  }

  async verify(id: string): Promise<Payment> {
    const payment = await this.requirePending(id);
    const verified = await this.repo.setStatus(payment.id, 'VERIFIED');
    // Auto-allocate FIFO across the account's open installments; residue → over-payment credit.
    await this.ledger.allocateOnVerify(verified);
    return verified;
  }

  async reject(id: string, dto: RejectPaymentDto): Promise<Payment> {
    const payment = await this.requirePending(id);
    return this.repo.setStatus(payment.id, 'REJECTED', dto.note);
  }

  /** Email the parent that a settled payment was received, and record it (staff-triggered). */
  async notifyParent(id: string): Promise<Payment> {
    const payment = await this.repo.findById(id);
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'VERIFIED') {
      throw new ConflictException('Only a settled (verified) payment can be notified');
    }
    const { studentNameEn, parentEmail } = await this.repo.studentNotifyContact(payment.studentId);
    if (!parentEmail) {
      throw new BadRequestException('No parent email on file for this student');
    }
    const schoolName = await this.repo.tenantName();
    const amount = `${payment.amount.toFixed(3)} JOD`;
    const subject = `${schoolName}: payment received`;

    // Render the official payment receipt (re-rendered from the live ledger) and attach it as a PDF.
    const receipt = await this.financeDocs.paymentReceipt(payment.id, 'EN');
    const { buffer } = await this.documents.renderBuilt(receipt);
    const filename = `receipt-${payment.receiptNo != null ? docNumber('RCPT', payment.receiptNo) : payment.id}.pdf`;

    const html =
      `<p>Dear parent,</p>` +
      `<p>We confirm we have received a payment of <strong>${amount}</strong>` +
      `${studentNameEn ? ` for <strong>${studentNameEn}</strong>` : ''}.</p>` +
      `<p>Your receipt is attached as a PDF.</p>` +
      `<p>Thank you,<br/>${schoolName}</p>`;
    const text =
      `Dear parent,\n\nWe confirm we have received a payment of ${amount}` +
      `${studentNameEn ? ` for ${studentNameEn}` : ''}.\n\nYour receipt is attached as a PDF.\n\nThank you,\n${schoolName}`;
    const domain = this.config.get('EMAIL_SENDER_DOMAIN', { infer: true });
    const fallbackFrom = this.config.get('EMAIL_FROM_FINANCE', { infer: true });
    const { from, replyTo } = await this.repo.financeSender(domain, fallbackFrom);
    const { sent } = await this.mail.send({
      to: parentEmail,
      subject,
      html,
      text,
      from,
      attachments: [{ filename, content: buffer }],
      ...(replyTo ? { replyTo } : {}),
    });
    if (!sent) {
      throw new ServiceUnavailableException('Email could not be sent (mail service unavailable)');
    }
    return this.repo.setParentNotified(id);
  }

  listForStudent(studentId: string): Promise<Payment[]> {
    return this.repo.findByStudent(studentId);
  }

  private async requirePending(id: string): Promise<Payment> {
    const payment = await this.repo.findById(id);
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'PENDING') {
      throw new ConflictException(`Payment is already ${payment.status}`);
    }
    return payment;
  }
}
