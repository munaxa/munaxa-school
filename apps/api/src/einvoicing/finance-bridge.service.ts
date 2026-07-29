import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { EInvoiceDocument } from '@prisma/client';
import { EInvoicingService } from './einvoicing.service';
import { FinanceBridgeRepository } from './finance-bridge.repository';

/**
 * Finance ↔ JoFotara bridge (Phase 19): turns a fee Charge into a JoFotara invoice, and a charge
 * reduction into a 381 credit note, reusing the e-invoicing engine (Phase 16) and the billing
 * ledger (Phase 17). The buyer is the student's primary guardian.
 *
 * The `try*` variants are best-effort (used by the auto-issue hooks) and never throw, so a
 * finance action is never blocked by an e-invoicing problem; the explicit methods surface errors.
 */
@Injectable()
export class FinanceBridgeService {
  private readonly logger = new Logger(FinanceBridgeService.name);

  constructor(
    private readonly einvoicing: EInvoicingService,
    private readonly repo: FinanceBridgeRepository,
  ) {}

  /** Invoice number derived deterministically from the charge → idempotent (unique per charge). */
  private invoiceNumber(chargeId: string): string {
    return `FEE-${chargeId.replace(/-/g, '').slice(0, 12).toUpperCase()}`;
  }
  private creditNumber(chargeId: string, seq: number): string {
    return `CN-${chargeId.replace(/-/g, '').slice(0, 10).toUpperCase()}-${seq}`;
  }

  /** Issue (create + queue) a JoFotara invoice for a fee charge. */
  async issueForCharge(chargeId: string): Promise<EInvoiceDocument> {
    const ctx = await this.repo.chargeContext(chargeId);
    if (!ctx) throw new NotFoundException('Charge not found in this tenant');
    if (ctx.charge.status === 'CANCELLED') {
      throw new ConflictException('Cannot invoice a cancelled charge');
    }
    const existing = await this.repo.existingInvoiceForCharge(chargeId);
    if (existing) {
      throw new ConflictException(`Charge already has an e-invoice (${existing.status})`);
    }
    if (!ctx.buyer?.name) {
      throw new BadRequestException(
        'No guardian on file for this student — a buyer is required for a receivable invoice',
      );
    }

    const unitPrice = Number(ctx.charge.amount);
    const discount = Number(ctx.discountTotal);
    const draft = await this.einvoicing.createInvoice({
      invoiceNumber: this.invoiceNumber(chargeId),
      paymentKind: 'RECEIVABLE',
      chargeId,
      studentId: ctx.studentId,
      buyerName: ctx.buyer.name,
      ...(ctx.buyer.nationalId ? { buyerIdScheme: 'NIN', buyerIdValue: ctx.buyer.nationalId } : {}),
      ...(ctx.buyer.phone ? { buyerPhone: ctx.buyer.phone } : {}),
      lines: [
        {
          name: ctx.charge.description,
          quantity: 1,
          unitPrice,
          ...(discount > 0 ? { discount } : {}),
        },
      ],
    });
    return this.einvoicing.queue(draft.id);
  }

  /** Issue a 381 credit note against the charge's accepted invoice (e.g. discount/withdrawal). */
  async issueCreditForCharge(
    chargeId: string,
    amount: number,
    reason: string,
  ): Promise<EInvoiceDocument> {
    const ctx = await this.repo.chargeContext(chargeId);
    if (!ctx) throw new NotFoundException('Charge not found in this tenant');
    const original = await this.repo.acceptedInvoiceForCharge(chargeId);
    if (!original) {
      throw new ConflictException('Charge has no accepted e-invoice to credit against');
    }
    if (amount <= 0) throw new BadRequestException('Credit amount must be positive');
    if (amount > Number(original.payableAmount)) {
      throw new BadRequestException('Credit amount exceeds the original invoice total');
    }
    // Mirror the original's single line (name must match) at the credit amount, quantity 1.
    const draft = await this.einvoicing.createCreditNote({
      invoiceNumber: this.creditNumber(chargeId, Date.now() % 100000),
      originalDocumentId: original.id,
      reason,
      lines: [{ name: ctx.charge.description, quantity: 1, unitPrice: amount }],
    });
    return this.einvoicing.queue(draft.id);
  }

  // ----------------------------------------------------------- best-effort hooks

  /** Auto-issue on charge creation when the tenant enabled it. Never throws. */
  async tryIssueForCharge(chargeId: string): Promise<void> {
    try {
      const settings = await this.repo.settings();
      if (!settings?.enabled || !settings.autoIssueOnCharge) return;
      await this.issueForCharge(chargeId);
    } catch (e) {
      this.logger.warn(
        `Auto-issue skipped for charge ${chargeId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /** Auto-credit when an invoiced charge is reduced. Never throws. */
  async tryCreditForCharge(chargeId: string, amount: number, reason: string): Promise<void> {
    try {
      const settings = await this.repo.settings();
      if (!settings?.enabled || !settings.autoCreditOnAdjustment) return;
      const accepted = await this.repo.acceptedInvoiceForCharge(chargeId);
      if (!accepted) return; // nothing to credit yet
      await this.issueCreditForCharge(chargeId, amount, reason);
    } catch (e) {
      this.logger.warn(
        `Auto-credit skipped for charge ${chargeId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
