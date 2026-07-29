import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EInvoiceDocument } from '@prisma/client';
import { CryptoService } from './crypto.service';
import { EInvoicingRepository } from './einvoicing.repository';
import { JoFotaraProvider } from './jofotara/jofotara.provider';
import { TenantConnectionManager } from '../prisma/tenant-connection.service';
import type { EInvoiceLineItem } from './provider.types';

const TICK_MS = 30_000;
const BATCH = 20;

/**
 * The submission queue worker: claims due QUEUED documents (FOR UPDATE SKIP LOCKED),
 * builds the provider payload, submits, and records the outcome (accept / reject /
 * retry-with-backoff / dead-letter). Covers the shared DB cross-tenant and each siloed
 * tenant database. SIMULATION tenants get a locally faked PASS — no network I/O —
 * because JoFotara has no public sandbox.
 *
 * Disabled tenants are skipped entirely (the kill-switch: no API calls, no processing).
 */
@Injectable()
export class SubmissionWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SubmissionWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly repo: EInvoicingRepository,
    private readonly crypto: CryptoService,
    private readonly provider: JoFotaraProvider,
    private readonly connections: TenantConnectionManager,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    // The worker is on by default outside tests; EINVOICE_WORKER=0 disables it (e2e).
    if (this.config.get<string>('EINVOICE_WORKER') === '0') return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** One processing pass. Public so tests (and a manual admin action) can drive it. */
  async tick(): Promise<number> {
    if (this.running) return 0; // re-entrancy guard
    this.running = true;
    try {
      let processed = 0;
      const claimed = await this.repo.claimDueShared(BATCH);
      for (const doc of claimed) processed += await this.process(doc);
      for (const tenantId of this.connections.siloedTenantIds()) {
        const docs = await this.repo.claimDueForTenant(tenantId, BATCH);
        for (const doc of docs) processed += await this.process(doc);
      }
      return processed;
    } catch (e) {
      this.logger.error(`Worker tick failed: ${e instanceof Error ? e.message : String(e)}`);
      return 0;
    } finally {
      this.running = false;
    }
  }

  private async process(doc: EInvoiceDocument): Promise<number> {
    const { settings, credential } = await this.repo.workerContext(doc.tenantId);
    if (!settings?.enabled) {
      // Kill-switch flipped while queued — park it back as a transient (will dead-letter).
      await this.repo.recordOutcome(doc.tenantId, doc.id, {
        kind: 'TRANSIENT',
        errorSummary: 'E-invoicing disabled for this tenant',
      });
      return 0;
    }

    const xml = this.provider.buildPayload(doc, {
      settings,
      incomeSourceSequence: credential?.incomeSourceSequence ?? '',
      taxpayerType: settings.taxpayerType,
      paymentKind: doc.paymentKind,
      lines: doc.lines as unknown as EInvoiceLineItem[],
      ...(doc.originalDocumentId ? { original: await this.originalRef(doc) } : {}),
    });

    if (settings.environment === 'SIMULATION') {
      await this.repo.recordOutcome(doc.tenantId, doc.id, {
        kind: 'ACCEPTED',
        submittedXml: xml,
        qrCode: `SIMULATED-QR-${doc.uuid}`,
        providerUuid: doc.uuid,
        validationResults: { status: 'PASS', simulated: true },
      });
      return 1;
    }

    if (!credential) {
      await this.repo.recordOutcome(doc.tenantId, doc.id, {
        kind: 'REJECTED',
        errorSummary: 'No device credentials configured (wizard step 3)',
        submittedXml: xml,
      });
      return 1;
    }

    const result = await this.provider.submit(
      xml,
      {
        clientId: credential.clientId,
        secret: this.crypto.decrypt(credential.secretEncrypted),
        incomeSourceSequence: credential.incomeSourceSequence,
      },
      settings.endpointUrl ?? this.provider.defaultEndpoint,
    );

    if (result.status === 'ACCEPTED') {
      await this.repo.recordOutcome(doc.tenantId, doc.id, {
        kind: 'ACCEPTED',
        submittedXml: xml,
        ...(result.qrCode ? { qrCode: result.qrCode } : {}),
        ...(result.signedDocument ? { signedDocument: result.signedDocument } : {}),
        ...(result.externalUuid ? { providerUuid: result.externalUuid } : {}),
        validationResults: result.validationResults,
      });
    } else if (result.status === 'REJECTED') {
      await this.repo.recordOutcome(doc.tenantId, doc.id, {
        kind: 'REJECTED',
        errorSummary: result.errorSummary ?? 'Rejected by provider',
        submittedXml: xml,
        validationResults: result.validationResults,
      });
    } else {
      await this.repo.recordOutcome(doc.tenantId, doc.id, {
        kind: 'TRANSIENT',
        errorSummary: result.errorSummary ?? 'Transient provider error',
      });
    }
    return 1;
  }

  private async originalRef(
    doc: EInvoiceDocument,
  ): Promise<{ number: string; uuid: string; total: number }> {
    const original = await this.repo.findOriginalForWorker(doc.tenantId, doc.originalDocumentId!);
    return {
      number: original?.invoiceNumber ?? '',
      uuid: original?.uuid ?? '',
      total: Number(original?.payableAmount ?? 0),
    };
  }
}
