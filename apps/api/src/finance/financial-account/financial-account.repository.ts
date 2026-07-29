import { BadRequestException, Injectable } from '@nestjs/common';
import {
  type Payer,
  type FinancialAccountOwnerType,
  type BillingResponsibilityReason,
} from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';
import { TenantContextStore } from '../../prisma/tenant-context';
import type { TxClient } from '../../prisma/tenant.helpers';

/** A student billed through a financial account (for the dashboard children section). */
export interface AccountStudent {
  studentId: string;
  studentAccountId: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameAr: string;
  lastNameAr: string;
  gradeNameEn: string | null;
  gradeNameAr: string | null;
}

/** A financial account matched by the multi-key search. */
export interface FamilySearchHit {
  financialAccountId: string | null; // the Payer id — null when the guardian has no account yet
  parentId: string | null;
  studentId: string | null; // set for a guardian-less student hit (no account/guardian yet)
  ownerType: FinancialAccountOwnerType | 'GUARDIAN';
  nameEn: string;
  nameAr: string;
  phone: string | null;
  email: string | null;
  nationalId: string | null;
  studentCount: number;
}

/**
 * Financial Account data access. The Financial Account IS the {@link Payer} (the customer that pays
 * for one or more students — usually a guardian, but the payer is not hard-coded: ownerType supports
 * company/government/sponsor/…). It owns the payment plans / payments / credits / refunds; students
 * remain the owners of their charges. `Payer` already groups a guardian's students (siblings share
 * one Payer, and StudentFinancialAccount.payerId links them), so there is no separate account table.
 * Tenant-scoped, RLS-enforced, audited — mirrors {@link AccountRepository} for the student side.
 */
@Injectable()
export class FinancialAccountRepository extends TenantRepository {
  private actor(): string | null {
    return TenantContextStore.get()?.actorUserId ?? null;
  }

  findById(id: string): Promise<Payer | null> {
    return this.run((tx) => tx.payer.findFirst({ where: { id } }));
  }

  /** The financial account (Payer) a student is billed through — for deep-linking into the workspace. */
  findByStudentId(studentId: string): Promise<Payer | null> {
    return this.run(async (tx) => {
      const account = await tx.studentFinancialAccount.findFirst({
        where: { studentId },
        select: { payerId: true },
      });
      if (!account?.payerId) return null;
      return tx.payer.findFirst({ where: { id: account.payerId } });
    });
  }

  /** The active financial account (Payer) for a guardian, if one exists (most-recent first). */
  findByParent(parentId: string): Promise<Payer | null> {
    return this.run((tx) =>
      tx.payer.findFirst({
        where: { parentId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  /**
   * Find-or-create the financial account (Payer) owned by a guardian. The same Payer is created by the
   * student-side ledger (`AccountRepository.ensurePayerForStudentTx`), so this is idempotent per
   * guardian. Composable in a larger transaction (the unified admission commit).
   */
  async ensureForParentTx(
    tx: TxClient,
    tenantId: string,
    parentId: string,
    ownerType: FinancialAccountOwnerType = 'GUARDIAN',
  ): Promise<Payer> {
    const existing = await tx.payer.findFirst({ where: { parentId } });
    if (existing) return existing;

    const parent = await tx.parent.findFirst({ where: { id: parentId, deletedAt: null } });
    if (!parent) throw new BadRequestException('Guardian not found in this tenant');

    const account = await tx.payer.create({
      data: {
        tenantId,
        parentId,
        ownerType,
        nameEn: `${parent.firstNameEn} ${parent.lastNameEn}`.trim(),
        nameAr: `${parent.firstNameAr} ${parent.lastNameAr}`.trim(),
        phone: parent.phone,
        email: parent.email,
        nationalId: parent.nationalId,
        createdById: this.actor(),
      },
    });
    await this.writeAudit(tx, tenantId, {
      action: 'finance.financialAccount.open',
      entityType: 'Payer',
      entityId: account.id,
      metadata: { parentId, ownerType },
    });
    return account;
  }

  ensureForParent(
    parentId: string,
    ownerType: FinancialAccountOwnerType = 'GUARDIAN',
  ): Promise<Payer> {
    return this.run((tx, tenantId) => this.ensureForParentTx(tx, tenantId, parentId, ownerType));
  }

  /**
   * EXPLICIT billing transfer — move a student's Financial Account to a different guardian (their new
   * payer), carrying the existing ledger. Changing the guardian relationship never does this on its
   * own; this is a deliberate, audited action. Only a single-student account may be moved here (moving
   * one child out of a shared family account would split shared plans — manage those in Finance).
   * Charges hang off the per-student account and follow it automatically; payer-scoped rows (payments,
   * credits, refunds, plans) are repointed to the new payer.
   */
  async transferBilling(
    studentId: string,
    toParentId: string,
    reason: BillingResponsibilityReason,
    notes?: string,
  ) {
    return this.run(async (tx, tenantId) => {
      const sfa = await tx.studentFinancialAccount.findUnique({
        where: { studentId },
        select: { id: true, payerId: true },
      });
      if (!sfa) throw new BadRequestException('This student has no financial account to transfer.');
      const fromPayerId = sfa.payerId;

      const link = await tx.parentStudent.findFirst({
        where: { studentId, parentId: toParentId },
        select: { id: true },
      });
      if (!link) throw new BadRequestException('That guardian is not linked to this student.');

      if (fromPayerId) {
        const siblings = await tx.studentFinancialAccount.count({
          where: { payerId: fromPayerId, studentId: { not: studentId } },
        });
        if (siblings > 0) {
          throw new BadRequestException(
            'This student is billed through a shared family account. Transferring one child’s ' +
              'billing is not supported here — manage it in Finance.',
          );
        }
      }

      // Refuse while finance workflows are in flight — moving the payer mid-flight would corrupt the
      // trail. Existing issued (ACCEPTED) e-invoices are NEVER rewritten; the transfer is the payer
      // boundary and future invoices bill the new payer. Only IN-PROGRESS issuance blocks.
      const [pendingPayments, pendingRefunds, pendingInvoices] = await Promise.all([
        tx.payment.count({ where: { accountId: sfa.id, status: 'PENDING' } }),
        tx.refund.count({ where: { accountId: sfa.id, status: 'PENDING' } }),
        tx.eInvoiceDocument.count({
          where: { studentId, status: { in: ['DRAFT', 'QUEUED', 'SUBMITTING'] } },
        }),
      ]);
      if (pendingPayments + pendingRefunds + pendingInvoices > 0) {
        throw new BadRequestException(
          'Cannot transfer billing responsibility. There are pending financial operations ' +
            '(payment verification, refund, or e-invoice issuance) that must be completed first.',
        );
      }

      const target = await this.ensureForParentTx(tx, tenantId, toParentId);
      if (fromPayerId === target.id) return { studentId, payerId: target.id, moved: false };

      await tx.studentFinancialAccount.update({
        where: { studentId },
        data: { payerId: target.id },
      });
      // Single-student account → every payer-scoped row under the old payer belongs to this student.
      if (fromPayerId) {
        await tx.payment.updateMany({
          where: { payerId: fromPayerId },
          data: { payerId: target.id },
        });
        await tx.credit.updateMany({
          where: { payerId: fromPayerId },
          data: { payerId: target.id },
        });
        await tx.refund.updateMany({
          where: { payerId: fromPayerId },
          data: { payerId: target.id },
        });
        await tx.financialAccountPlan.updateMany({
          where: { payerId: fromPayerId },
          data: { payerId: target.id },
        });
      } else {
        await tx.payment.updateMany({ where: { accountId: sfa.id }, data: { payerId: target.id } });
        await tx.credit.updateMany({ where: { accountId: sfa.id }, data: { payerId: target.id } });
        await tx.refund.updateMany({ where: { accountId: sfa.id }, data: { payerId: target.id } });
      }

      // Dedicated financial business event (preserves the payer history + is reportable), plus the
      // generic audit row.
      const event = await tx.billingResponsibilityTransfer.create({
        data: {
          tenantId,
          studentFinancialAccountId: sfa.id,
          studentId,
          fromPayerId,
          toPayerId: target.id,
          reason,
          ...(notes ? { notes } : {}),
          performedById: this.actor(),
        },
        select: { id: true },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'finance.billingTransfer',
        entityType: 'StudentFinancialAccount',
        entityId: sfa.id,
        metadata: {
          studentId,
          fromPayerId,
          toPayerId: target.id,
          toParentId,
          reason,
          eventId: event.id,
        },
      });
      return { studentId, payerId: target.id, moved: true, transferId: event.id };
    });
  }

  /** The billing-responsibility history for a student (newest first) — for the "Billing History" view. */
  billingHistory(studentId: string) {
    return this.run((tx) =>
      tx.billingResponsibilityTransfer.findMany({
        where: { studentId },
        orderBy: { performedAt: 'desc' },
      }),
    );
  }

  /**
   * Link a student's AR account to a financial account (Payer). The student's charges stay
   * student-owned; this only records who the paying customer is (sets StudentFinancialAccount.payerId).
   */
  async linkStudentAccountTx(
    tx: TxClient,
    studentAccountId: string,
    payerId: string,
  ): Promise<void> {
    await tx.studentFinancialAccount.update({
      where: { id: studentAccountId },
      data: { payerId },
    });
  }

  /** The students billed through a financial account (dashboard children section). */
  studentsOf(payerId: string): Promise<AccountStudent[]> {
    return this.run(async (tx) => {
      const accounts = await tx.studentFinancialAccount.findMany({
        where: { payerId, student: { deletedAt: null } },
        select: {
          id: true,
          student: {
            select: {
              id: true,
              firstNameEn: true,
              lastNameEn: true,
              firstNameAr: true,
              lastNameAr: true,
              section: { select: { grade: { select: { nameEn: true, nameAr: true } } } },
            },
          },
        },
      });
      return accounts
        .filter((a) => a.student)
        .map((a) => ({
          studentId: a.student.id,
          studentAccountId: a.id,
          firstNameEn: a.student.firstNameEn,
          lastNameEn: a.student.lastNameEn,
          firstNameAr: a.student.firstNameAr,
          lastNameAr: a.student.lastNameAr,
          gradeNameEn: a.student.section?.grade?.nameEn ?? null,
          gradeNameAr: a.student.section?.grade?.nameAr ?? null,
        }));
    });
  }

  /** Student ids billed through a financial account (allocation / summary scope). */
  studentIdsOf(payerId: string): Promise<string[]> {
    return this.run(async (tx) => {
      const rows = await tx.studentFinancialAccount.findMany({
        where: { payerId },
        select: { studentId: true },
      });
      return rows.map((r) => r.studentId);
    });
  }

  /**
   * Account-first search. Matches guardians by name / phone / national id, and by any linked
   * student's name / national id, then projects each onto its financial account (Payer). Deduped by
   * guardian, capped for the picker.
   */
  search(query: string): Promise<FamilySearchHit[]> {
    const q = query.trim();
    return this.run(async (tx) => {
      if (q.length < 2) return [];
      const like = { contains: q, mode: 'insensitive' as const };
      const parents = await tx.parent.findMany({
        where: {
          deletedAt: null,
          OR: [
            { firstNameEn: like },
            { lastNameEn: like },
            { firstNameAr: like },
            { lastNameAr: like },
            { phone: like },
            { phoneAlt: like },
            { nationalId: like },
            {
              studentLinks: {
                some: {
                  student: {
                    deletedAt: null,
                    OR: [
                      { firstNameEn: like },
                      { lastNameEn: like },
                      { firstNameAr: like },
                      { lastNameAr: like },
                      { nationalId: like },
                    ],
                  },
                },
              },
            },
          ],
        },
        select: {
          id: true,
          firstNameEn: true,
          lastNameEn: true,
          firstNameAr: true,
          lastNameAr: true,
          phone: true,
          email: true,
          nationalId: true,
          _count: { select: { studentLinks: true } },
          payers: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, ownerType: true },
          },
          // Fallback: where THIS guardian's students are actually billed. A guardian who becomes a
          // student's parent AFTER admission has no own Payer, but the student is billed through the
          // admission payer — surface that account so finance never dead-ends (billing is only MOVED
          // via an explicit transfer, never automatically).
          studentLinks: {
            where: { student: { deletedAt: null, financialAccount: { payerId: { not: null } } } },
            take: 1,
            select: { student: { select: { financialAccount: { select: { payerId: true } } } } },
          },
        },
        take: 25,
        orderBy: [{ firstNameEn: 'asc' }],
      });
      const parentHits: FamilySearchHit[] = parents.map((p) => ({
        financialAccountId:
          p.payers[0]?.id ?? p.studentLinks[0]?.student.financialAccount?.payerId ?? null,
        parentId: p.id,
        studentId: null,
        ownerType: p.payers[0]?.ownerType ?? 'GUARDIAN',
        nameEn: `${p.firstNameEn} ${p.lastNameEn}`.trim(),
        nameAr: `${p.firstNameAr} ${p.lastNameAr}`.trim(),
        phone: p.phone,
        email: p.email,
        nationalId: p.nationalId,
        studentCount: p._count.studentLinks,
      }));

      // Also surface students who have NO guardian on file — an account search would otherwise never
      // find them. Returned as guardian-less hits (studentId set, no account); the UI routes the user
      // to assign a guardian, which places the student under that guardian's Financial Account.
      const orphanStudents = await tx.student.findMany({
        where: {
          deletedAt: null,
          parentLinks: { none: {} },
          OR: [
            { firstNameEn: like },
            { lastNameEn: like },
            { firstNameAr: like },
            { lastNameAr: like },
            { nationalId: like },
          ],
        },
        select: {
          id: true,
          firstNameEn: true,
          lastNameEn: true,
          firstNameAr: true,
          lastNameAr: true,
          nationalId: true,
        },
        take: 25,
        orderBy: [{ firstNameEn: 'asc' }],
      });
      const studentHits: FamilySearchHit[] = orphanStudents.map((s) => ({
        financialAccountId: null,
        parentId: null,
        studentId: s.id,
        ownerType: 'GUARDIAN',
        nameEn: `${s.firstNameEn} ${s.lastNameEn}`.trim(),
        nameAr: `${s.firstNameAr} ${s.lastNameAr}`.trim(),
        phone: null,
        email: null,
        nationalId: s.nationalId,
        studentCount: 1,
      }));

      return [...parentHits, ...studentHits];
    });
  }

  /** The active account payment plan for an account (Payer) + year (if any). */
  activePlanFor(payerId: string, academicYearId?: string) {
    return this.run((tx) =>
      tx.financialAccountPlan.findFirst({
        where: {
          payerId,
          status: 'ACTIVE',
          ...(academicYearId ? { academicYearId } : {}),
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }
}
