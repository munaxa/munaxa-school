import { Module } from '@nestjs/common';
import { StorageService } from '../common/storage.service';
import { EInvoicingModule } from '../einvoicing/einvoicing.module';
import { CommunicationModule } from '../communication/communication.module';
import { DocumentsModule } from '../documents/documents.module';
import { AccountController } from './account/account.controller';
import { AccountService } from './account/account.service';
import { AccountRepository } from './account/account.repository';
import { FinancialAccountController } from './financial-account/financial-account.controller';
import { FinancialAccountService } from './financial-account/financial-account.service';
import { FinancialAccountRepository } from './financial-account/financial-account.repository';
import { ChargeController } from './charges/charge.controller';
import { ChargeService } from './charges/charge.service';
import { ChargeRepository } from './charges/charge.repository';
import { InstallmentScheduleService } from './charges/installment-schedule.service';
import { PaymentController } from './payments/payment.controller';
import { PaymentService } from './payments/payment.service';
import { PaymentRepository } from './payments/payment.repository';
import { StatementController } from './statement/statement.controller';
import { StatementService } from './statement/statement.service';
import { LedgerController } from './ledger/ledger.controller';
import { LedgerService } from './ledger/ledger.service';
import { LedgerRepository } from './ledger/ledger.repository';
import { FifoByDueDatePolicy } from './ledger/allocation-policy';
import { CollectionsController } from './collections/collections.controller';
import { CollectionsService } from './collections/collections.service';
import { CollectionsRepository } from './collections/collections.repository';
import { SmsService } from './collections/sms.service';
import { FeeConfigController } from './fee-config/fee-config.controller';
import { FeeConfigService } from './fee-config/fee-config.service';
import { FeeConfigRepository } from './fee-config/fee-config.repository';
import { EnrollmentController } from './enrollment/enrollment.controller';
import { EnrollmentService } from './enrollment/enrollment.service';
import { AdmissionsController } from './admissions/admissions.controller';
import { AdmissionsService } from './admissions/admissions.service';
import { AdmissionsRepository } from './admissions/admissions.repository';
import { QuoteService } from './admissions/quote.service';
import { StudentIdentityService } from './admissions/student-identity.service';
import { StudentIdentityRepository } from './admissions/student-identity.repository';
import { FinanceReportsController } from './reports/reports.controller';
import { FinanceReportsRepository } from './reports/reports.repository';

/**
 * Finance — the Accounts Receivable engine (Finance Domain Spec v1.0). Student Financial
 * Accounts + Payers, Charges (obligations) with Payment Plans and Installments, Payments
 * (receipt upload → verify with gapless numbering → FIFO allocation to installments), the AR
 * ledger (adjustments, credits, refunds), the hierarchical statement, collections/dunning, fee
 * configuration, and admissions/enrollment. Every derived figure is recomputed from child rows
 * (single source of truth); every financial state change writes an AuditLog in the same
 * transaction; invoices originate only from Charges (JoFotara bridge).
 */
@Module({
  imports: [EInvoicingModule, CommunicationModule, DocumentsModule],
  controllers: [
    AccountController,
    FinancialAccountController,
    ChargeController,
    PaymentController,
    StatementController,
    LedgerController,
    CollectionsController,
    FinanceReportsController,
    FeeConfigController,
    EnrollmentController,
    AdmissionsController,
  ],
  providers: [
    StorageService,
    AccountService,
    AccountRepository,
    FinancialAccountService,
    FinancialAccountRepository,
    ChargeService,
    ChargeRepository,
    InstallmentScheduleService,
    PaymentService,
    PaymentRepository,
    StatementService,
    LedgerService,
    LedgerRepository,
    FifoByDueDatePolicy,
    CollectionsService,
    CollectionsRepository,
    SmsService,
    FeeConfigService,
    FeeConfigRepository,
    EnrollmentService,
    AdmissionsService,
    AdmissionsRepository,
    QuoteService,
    StudentIdentityService,
    StudentIdentityRepository,
    FinanceReportsRepository,
  ],
  // AccountRepository is exported so the People module can place a student under their guardian's
  // Financial Account when a parent is (re)assigned (keeps billing linkage in sync).
  exports: [AccountRepository, AdmissionsService, QuoteService, ChargeService],
})
export class FinanceModule {}
