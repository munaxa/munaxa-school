import { Injectable, NotFoundException } from '@nestjs/common';
import type { BillingResponsibilityReason, Payer } from '@prisma/client';
import { FinancialAccountRepository, type AccountStudent } from './financial-account.repository';
import {
  LedgerRepository,
  type FinancialAccountSummary,
  type BillingSchedule,
} from '../ledger/ledger.repository';
import { FinanceReportsRepository, type FinanceOverview } from '../reports/reports.repository';

/** The Financial Account dashboard payload: account (Payer) header, account totals, and the children. */
export interface FinancialAccountDashboard {
  account: Payer;
  summary: FinancialAccountSummary;
  students: AccountStudent[];
}

/**
 * Financial-account context service — the family-first finance dashboard. Resolves the account,
 * aggregates the family totals from the ledger (Σ per-student, sharing the single source of truth),
 * and lists the children. Students are always the owners of their charges; this reads across them.
 */
@Injectable()
export class FinancialAccountService {
  constructor(
    private readonly repo: FinancialAccountRepository,
    private readonly ledger: LedgerRepository,
    private readonly reports: FinanceReportsRepository,
  ) {}

  /** Family-first search by guardian / father / mother / family name / phone / national id / student. */
  search(query: string) {
    return this.repo.search(query ?? '');
  }

  /** Account-centric finance overview (the workspace dashboard shown before an account is opened). */
  overview(): Promise<FinanceOverview> {
    return this.reports.financeOverview();
  }

  /** Resolve a student to their Financial Account (Payer) — powers "Open in finance" deep-links. */
  async byStudent(studentId: string): Promise<{ account: Payer | null; studentId: string }> {
    return { account: await this.repo.findByStudentId(studentId), studentId };
  }

  /** Ensure (find-or-create) a financial account for a guardian. */
  ensureForParent(parentId: string) {
    return this.repo.ensureForParent(parentId);
  }

  /** Explicitly move a student's billing to another (already-linked) guardian. Audited; carries the ledger. */
  transferBilling(
    studentId: string,
    toParentId: string,
    reason: BillingResponsibilityReason,
    notes?: string,
  ) {
    return this.repo.transferBilling(studentId, toParentId, reason, notes);
  }

  /** The active financial account (Payer) for a guardian, plus its students — or null. Drives the
   * unified admission wizard's "add to existing account" branch (Merge / Separate / New plan). */
  async byParent(parentId: string) {
    const account = await this.repo.findByParent(parentId);
    if (!account) return { account: null, students: [] };
    return { account, students: await this.repo.studentsOf(account.id) };
  }

  /** The account's Billing Schedule — the single, dynamically merged installment plan (read model). */
  async billingSchedule(financialAccountId: string): Promise<BillingSchedule> {
    const account = await this.repo.findById(financialAccountId);
    if (!account) throw new NotFoundException('Financial account not found');
    return this.ledger.billingSchedule(financialAccountId);
  }

  /** The Family Finance Dashboard for a financial account (KPIs default to family totals). */
  async dashboard(financialAccountId: string): Promise<FinancialAccountDashboard> {
    const account = await this.repo.findById(financialAccountId);
    if (!account) throw new NotFoundException('Financial account not found');
    const [summary, students] = await Promise.all([
      this.ledger.financialAccountSummary(financialAccountId),
      this.repo.studentsOf(financialAccountId),
    ]);
    return { account, summary, students };
  }
}
