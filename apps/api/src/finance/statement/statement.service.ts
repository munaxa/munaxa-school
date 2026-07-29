import { Injectable } from '@nestjs/common';
import type { Credit, FeeAdjustment, Refund } from '@prisma/client';
import { PaymentRepository, type DetailedPayment } from '../payments/payment.repository';
import { AccountRepository } from '../account/account.repository';
import { FinancialAccountRepository } from '../financial-account/financial-account.repository';
import {
  LedgerRepository,
  type AccountSummary,
  type FinancialAccountSummary,
  type ChargeView,
} from '../ledger/ledger.repository';

export interface StudentStatement {
  studentId: string;
  account: { id: string; currency: string; status: string; payerId: string | null };
  /** Hierarchical: charge (obligation) → plan → installments, with per-node balances (§13). */
  charges: ChargeView[];
  payments: DetailedPayment[];
  adjustments: FeeAdjustment[];
  credits: Array<Credit & { remaining: string }>;
  refunds: Refund[];
  totals: AccountSummary;
}

export interface HouseholdMember {
  studentId: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string;
  lastNameAr: string;
  outstanding: string;
}

export interface ParentStudent {
  studentId: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string;
  lastNameAr: string;
  gradeNameEn: string | null;
  gradeNameAr: string | null;
  transportRequested: boolean;
  relation: string;
  isPrimary: boolean;
  outstanding: string;
}

/**
 * Student financial statement: the hierarchical account view (Account → Charges → Plans →
 * Installments) plus payments, adjustments, credits, refunds and the derived totals — every
 * figure recomputed from the ledger (the single source of truth), never stored (§13, LR-*).
 */
/** A family statement: the account's family totals + each child's per-student totals (drill-down). */
export interface FamilyStatement {
  financialAccountId: string;
  totals: FinancialAccountSummary;
  children: Array<{
    studentId: string;
    firstNameEn: string;
    lastNameEn: string;
    firstNameAr: string;
    lastNameAr: string;
    gradeNameEn: string | null;
    gradeNameAr: string | null;
    totals: AccountSummary;
  }>;
  payments: DetailedPayment[];
}

@Injectable()
export class StatementService {
  constructor(
    private readonly ledger: LedgerRepository,
    private readonly payments: PaymentRepository,
    private readonly accounts: AccountRepository,
    private readonly financialAccounts: FinancialAccountRepository,
  ) {}

  /**
   * Family statement — the finance-first default: the family totals (KPIs) plus each child's own
   * per-student totals for drill-down. Every figure comes from the ledger (single source of truth).
   */
  async forFamily(financialAccountId: string): Promise<FamilyStatement> {
    const [totals, students] = await Promise.all([
      this.ledger.financialAccountSummary(financialAccountId),
      this.financialAccounts.studentsOf(financialAccountId),
    ]);
    const children = await Promise.all(
      students.map(async (s) => ({
        studentId: s.studentId,
        firstNameEn: s.firstNameEn,
        lastNameEn: s.lastNameEn,
        firstNameAr: s.firstNameAr,
        lastNameAr: s.lastNameAr,
        gradeNameEn: s.gradeNameEn,
        gradeNameAr: s.gradeNameAr,
        totals: await this.ledger.accountSummary(s.studentId),
      })),
    );
    const payments = await this.payments.findDetailedByFinancialAccount(financialAccountId);
    return { financialAccountId, totals, children, payments };
  }

  async forStudent(studentId: string): Promise<StudentStatement> {
    const account = await this.accounts.ensureAccount(studentId);
    const [charges, payments, adjustments, credits, refunds, totals] = await Promise.all([
      this.ledger.chargeViews(studentId),
      this.payments.findDetailedByStudent(studentId),
      this.ledger.listAdjustments(studentId),
      this.ledger.listCredits(studentId),
      this.ledger.listRefunds(studentId),
      this.ledger.accountSummary(studentId),
    ]);
    return {
      studentId,
      account: {
        id: account.id,
        currency: account.currency,
        status: account.status,
        payerId: account.payerId,
      },
      charges,
      payments,
      adjustments,
      credits,
      refunds,
      totals,
    };
  }

  /** A guardian's students with grade, transport demand and each one's outstanding balance. */
  async parentStudents(parentId: string): Promise<ParentStudent[]> {
    const students = await this.accounts.studentsForParent(parentId);
    return Promise.all(
      students.map(async (s) => ({
        studentId: s.id,
        firstNameEn: s.firstNameEn,
        lastNameEn: s.lastNameEn,
        firstNameAr: s.firstNameAr,
        lastNameAr: s.lastNameAr,
        gradeNameEn: s.section?.grade?.nameEn ?? null,
        gradeNameAr: s.section?.grade?.nameAr ?? null,
        transportRequested: s.transportRequested,
        relation: s.relation,
        isPrimary: s.isPrimary,
        outstanding: (await this.ledger.accountSummary(s.id)).outstanding,
      })),
    );
  }

  /** Siblings (students sharing a guardian) with each one's outstanding balance. */
  async household(studentId: string): Promise<HouseholdMember[]> {
    const siblings = await this.accounts.siblingsOf(studentId);
    return Promise.all(
      siblings.map(async (s) => ({
        studentId: s.id,
        firstNameEn: s.firstNameEn,
        lastNameEn: s.lastNameEn,
        firstNameAr: s.firstNameAr,
        lastNameAr: s.lastNameAr,
        outstanding: (await this.ledger.accountSummary(s.id)).outstanding,
      })),
    );
  }
}
