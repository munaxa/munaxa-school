import { Module } from '@nestjs/common';

// The ICV counter is a BigInt column (gapless, unbounded). JSON.stringify cannot serialise
// BigInt natively, so responses carrying `icv` would 500 — emit it as a string instead.
(BigInt.prototype as unknown as { toJSON?: () => string }).toJSON = function (this: bigint) {
  return this.toString();
};
import { CryptoService } from './crypto.service';
import { EInvoicingController } from './einvoicing.controller';
import { EInvoicingRepository } from './einvoicing.repository';
import { EInvoicingService } from './einvoicing.service';
import { JoFotaraProvider } from './jofotara/jofotara.provider';
import { SubmissionWorker } from './submission.worker';
import { FinanceBridgeService } from './finance-bridge.service';
import { FinanceBridgeRepository } from './finance-bridge.repository';

/**
 * E-Invoicing framework (Phase 16) — provider-agnostic engine with JoFotara (Jordan/ISTD)
 * as Provider #1. Disabled by default per tenant via the `e_invoicing` feature flag; when
 * off there is no generation, no API calls, and no queue processing for that tenant.
 *
 * Compliance basis: docs/integrations/jofotara/01-compliance-analysis.md
 * Architecture:     docs/integrations/jofotara/02-einvoicing-architecture.md
 */
@Module({
  controllers: [EInvoicingController],
  providers: [
    CryptoService,
    JoFotaraProvider,
    EInvoicingRepository,
    EInvoicingService,
    SubmissionWorker,
    FinanceBridgeService,
    FinanceBridgeRepository,
  ],
  exports: [EInvoicingService, FinanceBridgeService],
})
export class EInvoicingModule {}
