import { Injectable, NotFoundException } from '@nestjs/common';
import type { StudentFinancialAccount } from '@prisma/client';
import { AccountRepository } from './account.repository';
import { LedgerRepository, type AccountSummary } from '../ledger/ledger.repository';

export interface AccountView {
  account: StudentFinancialAccount;
  summary: AccountSummary;
}

/** Student Financial Account context service (the AR account header + summary). */
@Injectable()
export class AccountService {
  constructor(
    private readonly repo: AccountRepository,
    private readonly ledger: LedgerRepository,
  ) {}

  async forStudent(studentId: string): Promise<AccountView> {
    if (!(await this.repo.studentExists(studentId))) {
      throw new NotFoundException('Student not found in this tenant');
    }
    const account = await this.repo.ensureAccount(studentId);
    const summary = await this.ledger.accountSummary(studentId);
    return { account, summary };
  }
}
