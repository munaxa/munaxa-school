import { Injectable } from '@nestjs/common';
import { type Payer, type StudentFinancialAccount } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';
import { TenantContextStore } from '../../prisma/tenant-context';
import type { TxClient } from '../../prisma/tenant.helpers';

/**
 * Student Financial Account + Payer data access (AR account context). The account is the AR
 * ledger owner for one student; a Payer is the billing party (usually the primary guardian).
 * `ensureAccount` is the single entry point that lazily creates the account (and links a payer
 * from the primary guardian) — called at charge/enrollment time so every receivable has a home.
 */
@Injectable()
export class AccountRepository extends TenantRepository {
  private actor(): string | null {
    return TenantContextStore.get()?.actorUserId ?? null;
  }

  findByStudent(studentId: string): Promise<StudentFinancialAccount | null> {
    return this.run((tx) => tx.studentFinancialAccount.findFirst({ where: { studentId } }));
  }

  /** Find-or-create the account for a student, linking a Payer from the primary guardian. */
  ensureAccount(studentId: string): Promise<StudentFinancialAccount> {
    return this.run((tx, tenantId) => this.ensureAccountTx(tx, tenantId, studentId));
  }

  /** Transactional variant so callers can compose account creation with charge creation. */
  async ensureAccountTx(
    tx: TxClient,
    tenantId: string,
    studentId: string,
  ): Promise<StudentFinancialAccount> {
    const existing = await tx.studentFinancialAccount.findFirst({ where: { studentId } });
    if (existing) return existing;

    const payerId = await this.ensurePayerForStudentTx(tx, tenantId, studentId);
    const account = await tx.studentFinancialAccount.create({
      data: { tenantId, studentId, payerId },
    });
    await this.writeAudit(tx, tenantId, {
      action: 'finance.account.open',
      entityType: 'StudentFinancialAccount',
      entityId: account.id,
      metadata: { studentId },
    });
    return account;
  }

  /**
   * Reconcile a student's financial account with their primary guardian's Payer. Called when a
   * guardian is (re)assigned in the People module: assigning the paying guardian is what places the
   * student under that guardian's Financial Account (so siblings share one account and family
   * payments allocate across them). Non-destructive: the account's payer is set only when it is
   * currently unset — a student already billed to another account (e.g. a company/sponsor payer) is
   * never moved. Idempotent.
   */
  reconcileStudentAccount(studentId: string): Promise<StudentFinancialAccount> {
    return this.run((tx, tenantId) => this.reconcileStudentAccountTx(tx, tenantId, studentId));
  }

  async reconcileStudentAccountTx(
    tx: TxClient,
    tenantId: string,
    studentId: string,
  ): Promise<StudentFinancialAccount> {
    const account = await this.ensureAccountTx(tx, tenantId, studentId);
    if (account.payerId) return account; // already billed to an account — do not move it
    const payerId = await this.ensurePayerForStudentTx(tx, tenantId, studentId);
    if (!payerId) return account; // no guardian to bill through yet
    const linked = await tx.studentFinancialAccount.update({
      where: { id: account.id },
      data: { payerId },
    });
    await this.writeAudit(tx, tenantId, {
      action: 'finance.account.link-payer',
      entityType: 'StudentFinancialAccount',
      entityId: linked.id,
      metadata: { studentId, payerId },
    });
    return linked;
  }

  /** Ensure a Payer exists for the student's primary guardian; returns its id (or null). */
  private async ensurePayerForStudentTx(
    tx: TxClient,
    tenantId: string,
    studentId: string,
  ): Promise<string | null> {
    const link = await tx.parentStudent.findFirst({
      where: { studentId },
      orderBy: { isPrimary: 'desc' },
      include: { parent: true },
    });
    const parent = link?.parent;
    if (!parent) return null;
    const existing = await tx.payer.findFirst({ where: { parentId: parent.id } });
    if (existing) return existing.id;
    const payer = await tx.payer.create({
      data: {
        tenantId,
        parentId: parent.id,
        nameEn: `${parent.firstNameEn} ${parent.lastNameEn}`.trim(),
        nameAr: `${parent.firstNameAr} ${parent.lastNameAr}`.trim(),
        phone: parent.phone,
        email: parent.email,
        createdById: this.actor(),
      },
    });
    return payer.id;
  }

  payerById(id: string): Promise<Payer | null> {
    return this.run((tx) => tx.payer.findFirst({ where: { id } }));
  }

  setStatus(
    studentId: string,
    status: StudentFinancialAccount['status'],
  ): Promise<StudentFinancialAccount> {
    return this.run(async (tx, tenantId) => {
      const account = await tx.studentFinancialAccount.update({
        where: { studentId },
        data: { status, ...(status !== 'ACTIVE' ? { closedAt: new Date() } : { closedAt: null }) },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'finance.account.status',
        entityType: 'StudentFinancialAccount',
        entityId: account.id,
        metadata: { status },
      });
      return account;
    });
  }

  studentExists(studentId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.student.findFirst({ where: { id: studentId, deletedAt: null } })) !== null,
    );
  }

  /** Siblings (students sharing a guardian) with their display names. */
  siblingsOf(studentId: string): Promise<
    Array<{
      id: string;
      firstNameEn: string;
      lastNameEn: string;
      firstNameAr: string;
      lastNameAr: string;
    }>
  > {
    return this.run(async (tx) => {
      const links = await tx.parentStudent.findMany({
        where: { studentId },
        select: { parentId: true },
      });
      const parentIds = links.map((l) => l.parentId);
      if (parentIds.length === 0) return [];
      const sibLinks = await tx.parentStudent.findMany({
        where: { parentId: { in: parentIds }, studentId: { not: studentId } },
        select: { studentId: true },
      });
      const ids = [...new Set(sibLinks.map((s) => s.studentId))];
      if (ids.length === 0) return [];
      return tx.student.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: {
          id: true,
          firstNameEn: true,
          lastNameEn: true,
          firstNameAr: true,
          lastNameAr: true,
        },
        orderBy: { firstNameEn: 'asc' },
      });
    });
  }

  /** A guardian's students with grade + transport demand (for the parent drill-down). */
  studentsForParent(parentId: string): Promise<
    Array<{
      id: string;
      firstNameEn: string;
      lastNameEn: string;
      firstNameAr: string;
      lastNameAr: string;
      transportRequested: boolean;
      relation: string;
      isPrimary: boolean;
      section: { grade: { nameEn: string; nameAr: string } | null } | null;
    }>
  > {
    return this.run(async (tx) => {
      const links = await tx.parentStudent.findMany({
        where: { parentId },
        select: {
          relation: true,
          isPrimary: true,
          student: {
            select: {
              id: true,
              firstNameEn: true,
              lastNameEn: true,
              firstNameAr: true,
              lastNameAr: true,
              transportRequested: true,
              deletedAt: true,
              section: { select: { grade: { select: { nameEn: true, nameAr: true } } } },
            },
          },
        },
        orderBy: { isPrimary: 'desc' },
      });
      return links
        .filter((l) => l.student && l.student.deletedAt === null)
        .map((l) => ({
          id: l.student.id,
          firstNameEn: l.student.firstNameEn,
          lastNameEn: l.student.lastNameEn,
          firstNameAr: l.student.firstNameAr,
          lastNameAr: l.student.lastNameAr,
          transportRequested: l.student.transportRequested,
          relation: l.relation,
          isPrimary: l.isPrimary,
          section: l.student.section,
        }));
    });
  }
}
