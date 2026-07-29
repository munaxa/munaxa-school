import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EInvoiceDocument, EInvoiceSettings, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { CryptoService } from './crypto.service';
import { EInvoicingRepository, InvalidDocumentStateError } from './einvoicing.repository';
import { JoFotaraProvider } from './jofotara/jofotara.provider';
import type { EInvoiceLineItem } from './provider.types';
import type {
  CreateCreditNoteDto,
  CreateInvoiceDto,
  SaveCredentialsDto,
  UpdateSettingsDto,
} from './einvoicing.dto';

/** Buyer info is mandatory for receivable invoices, and for cash above this (JOD). */
const CASH_BUYER_THRESHOLD_JOD = 10_000;

@Injectable()
export class EInvoicingService {
  constructor(
    private readonly repo: EInvoicingRepository,
    private readonly crypto: CryptoService,
    private readonly provider: JoFotaraProvider,
  ) {}

  // ------------------------------------------------------------------ wizard

  async getSettings(): Promise<
    EInvoiceSettings & {
      credential: { clientId: string; secretHint: string; incomeSourceSequence: string } | null;
    }
  > {
    const settings = await this.repo.getOrCreateSettings();
    const cred = await this.repo.activeCredential();
    return {
      ...settings,
      credential: cred
        ? {
            clientId: cred.clientId,
            secretHint: `••••${cred.secretHint}`,
            incomeSourceSequence: cred.incomeSourceSequence,
          }
        : null,
    };
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<EInvoiceSettings> {
    if (dto.taxNumber !== undefined && dto.taxNumber !== null && /\D/.test(dto.taxNumber)) {
      throw new BadRequestException('Tax number (TIN) must contain digits only');
    }
    return this.repo.updateSettings({
      ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      ...(dto.environment !== undefined ? { environment: dto.environment } : {}),
      ...(dto.endpointUrl !== undefined ? { endpointUrl: dto.endpointUrl } : {}),
      ...(dto.legalNameEn !== undefined ? { legalNameEn: dto.legalNameEn } : {}),
      ...(dto.legalNameAr !== undefined ? { legalNameAr: dto.legalNameAr } : {}),
      ...(dto.taxNumber !== undefined ? { taxNumber: dto.taxNumber } : {}),
      ...(dto.vatNumber !== undefined ? { vatNumber: dto.vatNumber } : {}),
      ...(dto.commercialRegistration !== undefined
        ? { commercialRegistration: dto.commercialRegistration }
        : {}),
      ...(dto.addressLine !== undefined ? { addressLine: dto.addressLine } : {}),
      ...(dto.city !== undefined ? { city: dto.city } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.taxpayerType !== undefined ? { taxpayerType: dto.taxpayerType } : {}),
      ...(dto.vatEnabled !== undefined ? { vatEnabled: dto.vatEnabled } : {}),
      ...(dto.vatPercent !== undefined ? { vatPercent: dto.vatPercent } : {}),
      ...(dto.defaultTaxCategory !== undefined
        ? { defaultTaxCategory: dto.defaultTaxCategory }
        : {}),
      ...(dto.defaultPaymentKind !== undefined
        ? { defaultPaymentKind: dto.defaultPaymentKind }
        : {}),
      ...(dto.autoIssueOnCharge !== undefined ? { autoIssueOnCharge: dto.autoIssueOnCharge } : {}),
      ...(dto.autoCreditOnAdjustment !== undefined
        ? { autoCreditOnAdjustment: dto.autoCreditOnAdjustment }
        : {}),
      ...(dto.fieldMappings !== undefined
        ? { fieldMappings: dto.fieldMappings as Prisma.InputJsonValue }
        : {}),
      ...(dto.templateConfig !== undefined
        ? { templateConfig: dto.templateConfig as Prisma.InputJsonValue }
        : {}),
      ...(dto.completedSteps !== undefined ? { completedSteps: dto.completedSteps } : {}),
    });
  }

  /** Step 3: store device credentials — secret encrypted at rest, never returned. */
  async saveCredentials(
    dto: SaveCredentialsDto,
  ): Promise<{ clientId: string; secretHint: string }> {
    const cred = await this.repo.saveCredential({
      clientId: dto.clientId,
      secretEncrypted: this.crypto.encrypt(dto.secret),
      secretHint: dto.secret.slice(-4),
      incomeSourceSequence: dto.incomeSourceSequence,
      deviceLabel: dto.deviceLabel ?? null,
    });
    return { clientId: cred.clientId, secretHint: `••••${cred.secretHint}` };
  }

  /** Step 3: "Test connection". SIMULATION short-circuits (no real call, by design). */
  async testConnection(): Promise<{ ok: boolean; detail: string }> {
    const settings = await this.repo.getOrCreateSettings();
    if (settings.environment === 'SIMULATION') {
      await this.repo.recordConnectionTest(true);
      return { ok: true, detail: 'Simulation environment — connection check passed locally' };
    }
    const cred = await this.repo.activeCredential();
    if (!cred) throw new BadRequestException('No device credentials saved yet');
    const result = await this.provider.testConnection(
      {
        clientId: cred.clientId,
        secret: this.crypto.decrypt(cred.secretEncrypted),
        incomeSourceSequence: cred.incomeSourceSequence,
      },
      settings.endpointUrl ?? this.provider.defaultEndpoint,
    );
    await this.repo.recordConnectionTest(result.ok);
    return result;
  }

  // --------------------------------------------------------------- documents

  /** Create a DRAFT invoice (from explicit lines; finance sources reference by id). */
  async createInvoice(dto: CreateInvoiceDto): Promise<EInvoiceDocument> {
    const settings = await this.requireConfigured();
    const lines = this.computeLines(dto.lines, settings);
    const totals = this.computeTotals(lines);
    const paymentKind = dto.paymentKind ?? settings.defaultPaymentKind;

    this.assertBuyerRules(paymentKind, totals.payable, dto.buyerName);

    return this.repo.createDraft({
      docType: 'INVOICE',
      paymentKind,
      invoiceNumber: dto.invoiceNumber.replace(/\//g, '_'),
      uuid: randomUUID(),
      chargeId: dto.chargeId ?? null,
      paymentId: dto.paymentId ?? null,
      studentId: dto.studentId ?? null,
      buyerName: dto.buyerName ?? null,
      buyerIdScheme: dto.buyerIdScheme ?? null,
      buyerIdValue: dto.buyerIdValue ?? null,
      buyerPhone: dto.buyerPhone ?? null,
      buyerCity: dto.buyerCity ?? null,
      taxExclusive: totals.taxExclusive,
      taxAmount: totals.tax,
      discountTotal: totals.discount,
      payableAmount: totals.payable,
      lines: lines as unknown as object[],
    });
  }

  /** Create a DRAFT credit note (381) — must reference an ACCEPTED original + reason. */
  async createCreditNote(dto: CreateCreditNoteDto): Promise<EInvoiceDocument> {
    const settings = await this.requireConfigured();
    const original = await this.repo.findDocument(dto.originalDocumentId);
    if (!original) throw new NotFoundException('Original document not found');
    if (original.status !== 'ACCEPTED') {
      throw new ConflictException('Credit notes can only reference an ACCEPTED invoice');
    }
    if (!dto.reason?.trim()) {
      throw new BadRequestException('A return reason is mandatory for credit notes');
    }
    const lines = this.computeLines(dto.lines, settings);
    // JoFotara allows returns on quantities only, never exceeding the original.
    const originalLines = original.lines as unknown as EInvoiceLineItem[];
    for (const line of lines) {
      const match = originalLines.find((l) => l.name === line.name);
      if (!match) {
        throw new BadRequestException(`Line "${line.name}" does not exist on the original invoice`);
      }
      if (line.quantity > match.quantity) {
        throw new BadRequestException(
          `Returned quantity for "${line.name}" exceeds the original (${match.quantity})`,
        );
      }
    }
    const totals = this.computeTotals(lines);
    return this.repo.createDraft({
      docType: 'CREDIT_NOTE',
      paymentKind: original.paymentKind,
      invoiceNumber: dto.invoiceNumber.replace(/\//g, '_'),
      uuid: randomUUID(),
      originalDocumentId: original.id,
      creditReason: dto.reason,
      studentId: original.studentId,
      buyerName: original.buyerName,
      buyerIdScheme: original.buyerIdScheme,
      buyerIdValue: original.buyerIdValue,
      taxExclusive: totals.taxExclusive,
      taxAmount: totals.tax,
      discountTotal: totals.discount,
      payableAmount: totals.payable,
      lines: lines as unknown as object[],
    });
  }

  /** DRAFT → QUEUED (allocates the ICV); the worker picks it up. */
  async queue(id: string): Promise<EInvoiceDocument> {
    await this.requireConfigured();
    return this.wrapState(() => this.repo.queueDocument(id));
  }

  requeue(id: string): Promise<EInvoiceDocument> {
    return this.wrapState(() => this.repo.requeueDocument(id));
  }

  cancel(id: string): Promise<EInvoiceDocument> {
    return this.wrapState(() => this.repo.cancelDocument(id));
  }

  async get(id: string): Promise<EInvoiceDocument> {
    const doc = await this.repo.findDocument(id);
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  list(filter: { status?: EInvoiceDocument['status']; take?: number }) {
    return this.repo.listDocuments(filter);
  }

  dashboard() {
    return this.repo.dashboard();
  }

  // ----------------------------------------------------------------- helpers

  private async requireConfigured(): Promise<EInvoiceSettings> {
    const settings = await this.repo.getOrCreateSettings();
    if (!settings.enabled) {
      throw new ConflictException('E-invoicing is not enabled for this school');
    }
    if (!settings.taxNumber || !(settings.legalNameEn || settings.legalNameAr)) {
      throw new ConflictException('School legal info is incomplete (wizard step 2)');
    }
    return settings;
  }

  /** Apply the tenant's tax config to raw lines (income taxpayers carry no tax at all). */
  private computeLines(
    raw: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      discount?: number;
      taxCategory?: 'Z' | 'O' | 'S';
      taxPercent?: number;
    }>,
    settings: EInvoiceSettings,
  ): EInvoiceLineItem[] {
    if (raw.length === 0) throw new BadRequestException('At least one line is required');
    return raw.map((l) => {
      const discount = l.discount ?? 0;
      if (l.quantity <= 0 || l.unitPrice < 0 || discount < 0) {
        throw new BadRequestException(
          'Quantities must be positive; prices and discounts non-negative',
        );
      }
      const base = l.quantity * l.unitPrice - discount;
      if (base < 0)
        throw new BadRequestException(`Discount exceeds the line amount for "${l.name}"`);
      const noTax = settings.taxpayerType === 'INCOME' || !settings.vatEnabled;
      const category = noTax
        ? 'Z'
        : (l.taxCategory ?? (settings.defaultTaxCategory as 'Z' | 'O' | 'S'));
      const percent =
        noTax || category !== 'S' ? 0 : (l.taxPercent ?? Number(settings.vatPercent ?? 16));
      const taxAmount = Math.round(base * percent * 10) / 1000; // base × %/100, rounded to 3 dp (JOD)
      return {
        name: l.name,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount,
        taxCategory: category,
        taxPercent: percent,
        taxAmount,
        lineTotal: base + taxAmount,
      };
    });
  }

  private computeTotals(lines: EInvoiceLineItem[]) {
    const taxExclusive = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const discount = lines.reduce((s, l) => s + l.discount, 0);
    const tax = lines.reduce((s, l) => s + l.taxAmount, 0);
    return { taxExclusive, discount, tax, payable: taxExclusive - discount + tax };
  }

  private assertBuyerRules(
    paymentKind: 'CASH' | 'RECEIVABLE',
    payable: number,
    buyerName: string | undefined,
  ): void {
    const required = paymentKind === 'RECEIVABLE' || payable > CASH_BUYER_THRESHOLD_JOD;
    if (required && !buyerName?.trim()) {
      throw new BadRequestException(
        'Buyer name is mandatory for receivable invoices and cash invoices above 10,000 JOD',
      );
    }
  }

  private async wrapState<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof InvalidDocumentStateError) {
        if (e.message.includes('not found')) throw new NotFoundException(e.message);
        throw new ConflictException(e.message);
      }
      throw e;
    }
  }
}
