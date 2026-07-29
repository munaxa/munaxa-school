import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { GradeRecord, Student } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';
import { TenantContextStore } from '../../prisma/tenant-context';

export interface AttendanceSummary {
  PRESENT: number;
  ABSENT: number;
  LATE: number;
  EXCUSED: number;
}

/** The parent-portal family finance landing: family totals + the children + payment history. */
export interface FamilyFinance {
  financialAccountId: string | null;
  totalCharges: string;
  totalPaid: string;
  outstanding: string;
  creditBalance: string;
  nextInstallment: { dueDate: string; amount: string } | null;
  children: Array<{
    studentId: string;
    firstNameEn: string;
    lastNameEn: string;
    firstNameAr: string;
    lastNameAr: string;
    outstanding: string;
  }>;
  payments: Array<{ id: string; amount: string; method: string; status: string; date: string }>;
}

@Injectable()
export class DashboardRepository extends TenantRepository {
  student(studentId: string): Promise<Student | null> {
    return this.run((tx) => tx.student.findFirst({ where: { id: studentId, deletedAt: null } }));
  }

  /** Attendance status tallies for a student since `since`. */
  async attendanceSummary(studentId: string, since: Date): Promise<AttendanceSummary> {
    const rows = await this.run((tx) =>
      tx.studentAttendance.groupBy({
        by: ['status'],
        where: { studentId, date: { gte: since } },
        _count: { _all: true },
      }),
    );
    const summary: AttendanceSummary = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const row of rows) {
      summary[row.status] = row._count._all;
    }
    return summary;
  }

  /** Count of upcoming homework for the student's section. */
  upcomingHomeworkCount(sectionId: string | null, from: Date): Promise<number> {
    if (!sectionId) return Promise.resolve(0);
    return this.run((tx) =>
      tx.homework.count({ where: { sectionId, deletedAt: null, dueDate: { gte: from } } }),
    );
  }

  recentGrades(studentId: string): Promise<GradeRecord[]> {
    return this.run((tx) =>
      tx.gradeRecord.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    );
  }

  /** Outstanding balance = SUM(active charges) − SUM(verified payments). */
  async outstandingBalance(studentId: string): Promise<string> {
    const [charges, paid] = await this.run((tx) =>
      Promise.all([
        tx.charge.aggregate({
          _sum: { amount: true },
          where: { studentId, status: { notIn: ['CANCELLED', 'WAIVED'] } },
        }),
        tx.payment.aggregate({
          _sum: { amount: true },
          where: { studentId, status: 'VERIFIED' },
        }),
      ]),
    );
    const charged = charges._sum.amount ?? new Prisma.Decimal(0);
    const settled = paid._sum.amount ?? new Prisma.Decimal(0);
    return charged.minus(settled).toFixed(3);
  }

  /**
   * The family finance landing for a guardian: family totals (charges/paid/outstanding/credit), the
   * next family installment, per-child outstanding, and the family payment history. Reads across the
   * guardian's students (billed through their FinancialAccount when present, else all linked children).
   * Figures derive from the ledger rows — the same source as the staff-side finance dashboard.
   */
  async familyFinance(parentId: string): Promise<FamilyFinance> {
    return this.run(async (tx) => {
      const ZERO = new Prisma.Decimal(0);
      const fa = await tx.payer.findFirst({
        where: { parentId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      let studentIds: string[] = [];
      if (fa) {
        const accts = await tx.studentFinancialAccount.findMany({
          where: { payerId: fa.id },
          select: { studentId: true },
        });
        studentIds = accts.map((a) => a.studentId);
      }
      if (studentIds.length === 0) {
        const links = await tx.parentStudent.findMany({
          where: { parentId },
          select: { studentId: true },
        });
        studentIds = [...new Set(links.map((l) => l.studentId))];
      }

      const students = await tx.student.findMany({
        where: { id: { in: studentIds }, deletedAt: null },
        select: {
          id: true,
          firstNameEn: true,
          lastNameEn: true,
          firstNameAr: true,
          lastNameAr: true,
        },
      });
      const liveIds = students.map((s) => s.id);

      const [chargeAgg, discountAgg, paidAgg] = await Promise.all([
        tx.charge.aggregate({
          where: { studentId: { in: liveIds }, status: { notIn: ['CANCELLED', 'WRITTEN_OFF'] } },
          _sum: { amount: true },
        }),
        tx.feeAdjustment.aggregate({
          where: { studentId: { in: liveIds }, status: 'APPLIED', chargeId: { not: null } },
          _sum: { amount: true },
        }),
        tx.paymentAllocation.aggregate({
          where: { reversedAt: null, installment: { charge: { studentId: { in: liveIds } } } },
          _sum: { amount: true },
        }),
      ]);

      // Open installment balances (outstanding + next due) across the family.
      const installments = await tx.installment.findMany({
        where: {
          charge: { studentId: { in: liveIds }, status: { notIn: ['CANCELLED', 'WRITTEN_OFF'] } },
          status: { notIn: ['CANCELLED', 'WAIVED'] },
        },
        select: { id: true, dueDate: true, amount: true, charge: { select: { studentId: true } } },
      });
      const paidByInst = new Map<string, Prisma.Decimal>();
      if (installments.length > 0) {
        const rows = await tx.paymentAllocation.groupBy({
          by: ['installmentId'],
          where: { installmentId: { in: installments.map((i) => i.id) }, reversedAt: null },
          _sum: { amount: true },
        });
        for (const r of rows) paidByInst.set(r.installmentId, r._sum.amount ?? ZERO);
      }
      let outstanding = ZERO;
      const perChild = new Map<string, Prisma.Decimal>();
      const openDated: Array<{ dueDate: Date; balance: Prisma.Decimal }> = [];
      for (const inst of installments) {
        const bal = inst.amount.minus(paidByInst.get(inst.id) ?? ZERO);
        if (bal.lessThanOrEqualTo(ZERO)) continue;
        outstanding = outstanding.plus(bal);
        perChild.set(
          inst.charge.studentId,
          (perChild.get(inst.charge.studentId) ?? ZERO).plus(bal),
        );
        if (inst.dueDate) openDated.push({ dueDate: inst.dueDate, balance: bal });
      }
      openDated.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
      const nextInstallment = openDated[0]
        ? {
            dueDate: openDated[0].dueDate.toISOString().slice(0, 10),
            amount: openDated[0].balance.toFixed(3),
          }
        : null;

      // Account credit balance.
      const credits = await tx.credit.findMany({
        where: {
          OR: [...(fa ? [{ payerId: fa.id }] : []), { account: { studentId: { in: liveIds } } }],
        },
        select: { id: true, amount: true },
      });
      let creditBalance = ZERO;
      if (credits.length > 0) {
        const consumed = await tx.refundConsumption.groupBy({
          by: ['creditId'],
          where: { creditId: { in: credits.map((c) => c.id) } },
          _sum: { amount: true },
        });
        const consumedBy = new Map(consumed.map((c) => [c.creditId, c._sum.amount ?? ZERO]));
        for (const c of credits) {
          const rem = c.amount.minus(consumedBy.get(c.id) ?? ZERO);
          if (rem.greaterThan(ZERO)) creditBalance = creditBalance.plus(rem);
        }
      }

      // Payment history: account payments + any per-student payments.
      const payments = await tx.payment.findMany({
        where: {
          OR: [...(fa ? [{ payerId: fa.id }] : []), { studentId: { in: liveIds } }],
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          amount: true,
          method: true,
          status: true,
          verifiedAt: true,
          createdAt: true,
        },
      });

      return {
        financialAccountId: fa?.id ?? null,
        totalCharges: (chargeAgg._sum.amount ?? ZERO)
          .minus(discountAgg._sum.amount ?? ZERO)
          .toFixed(3),
        totalPaid: (paidAgg._sum.amount ?? ZERO).toFixed(3),
        outstanding: outstanding.toFixed(3),
        creditBalance: creditBalance.toFixed(3),
        nextInstallment,
        children: students.map((s) => ({
          studentId: s.id,
          firstNameEn: s.firstNameEn,
          lastNameEn: s.lastNameEn,
          firstNameAr: s.firstNameAr,
          lastNameAr: s.lastNameAr,
          outstanding: (perChild.get(s.id) ?? ZERO).toFixed(3),
        })),
        payments: payments.map((p) => ({
          id: p.id,
          amount: p.amount.toFixed(3),
          method: p.method,
          status: p.status,
          date: (p.verifiedAt ?? p.createdAt).toISOString().slice(0, 10),
        })),
      };
    });
  }

  pendingLeaveCount(studentId: string): Promise<number> {
    return this.run((tx) => tx.leaveRequest.count({ where: { studentId, status: 'PENDING' } }));
  }

  upcomingPtmCount(studentId: string, from: Date): Promise<number> {
    return this.run((tx) =>
      tx.ptmBooking.count({
        where: { studentId, status: 'BOOKED', slot: { startsAt: { gte: from } } },
      }),
    );
  }

  documentCount(studentId: string): Promise<number> {
    return this.run((tx) => tx.document.count({ where: { studentId, deletedAt: null } }));
  }

  /** Unread in-app notifications for the acting user. */
  unreadNotificationCount(): Promise<number> {
    const userId = TenantContextStore.get()?.actorUserId;
    if (!userId) return Promise.resolve(0);
    return this.run((tx) => tx.notification.count({ where: { userId, readAt: null } }));
  }
}
