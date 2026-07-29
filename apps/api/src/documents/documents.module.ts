import { Module } from '@nestjs/common';
import { StorageService } from '../common/storage.service';
import { OrganizationModule } from '../organization/organization.module';
import { AccountRepository } from '../finance/account/account.repository';
import { FinancialAccountRepository } from '../finance/financial-account/financial-account.repository';
import { PaymentRepository } from '../finance/payments/payment.repository';
import { LedgerRepository } from '../finance/ledger/ledger.repository';
import { StatementService } from '../finance/statement/statement.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentRepository } from './document.repository';
import { DocumentEngineService } from './document-engine.service';
import { BrandingService } from './branding.service';
import { PdfRenderer } from './pdf/pdf-renderer';
import { FinanceDocumentsService } from './finance-documents.service';
import { RegistrationAgreementService } from './registration-agreement.service';

/**
 * Enterprise Document Engine (Phase 23). A reusable engine that generates every official school
 * document (registration agreements + finance documents) from a permanent snapshot, stores the PDF
 * immutably, and archives + audits every action. It *consumes* the existing billing ledger /
 * statement / organization data — it never duplicates any financial record.
 *
 * It re-provides the read-only finance collaborators (StatementService + its repositories) instead
 * of importing FinanceModule, so FinanceModule can depend on this module (for automatic
 * registration-agreement generation at commit time) without a circular module reference.
 */
@Module({
  imports: [OrganizationModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    DocumentEngineService,
    DocumentRepository,
    BrandingService,
    PdfRenderer,
    FinanceDocumentsService,
    RegistrationAgreementService,
    StorageService,
    // Read-only finance collaborators reused by the document collectors.
    StatementService,
    AccountRepository,
    FinancialAccountRepository,
    PaymentRepository,
    LedgerRepository,
  ],
  exports: [RegistrationAgreementService, DocumentEngineService, FinanceDocumentsService],
})
export class DocumentsModule {}
