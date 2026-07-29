import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  AdmissionStatus,
  ApprovalStatus,
  ChargeStatus,
  EnrollmentStatus,
  FeeItemKind,
  FinancialAccountOwnerType,
  ParentRelation,
  Prisma,
  QuotePaymentMode,
  StudentStatus,
  TransportDirection,
} from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantConnectionManager } from '../../prisma/tenant-connection.service';
import type { TxClient } from '../../prisma/tenant.helpers';
import { allocateStudentNumber } from '../../people/students/student-number';
import { TenantContextStore } from '../../prisma/tenant-context';
import { generateStudentQrCode } from '../../people/people.util';
import { AccountRepository } from '../account/account.repository';
import { FinancialAccountRepository } from '../financial-account/financial-account.repository';
import { addMonths, InstallmentScheduleService } from '../charges/installment-schedule.service';
import { fromFils, toFils } from '../shared/money';
import type { ComputedQuote } from './quote.service';
import {
  AddFamilyStudentMode,
  type AddFamilyStudentDto,
  type CommitDto,
  type CreateArrangementDto,
  type CreateFeeItemDto,
  type FamilyCommitDto,
  type FeeOverrideDto,
  type UpdateFeeItemDto,
  type UpsertGradeFeeItemDto,
} from './admissions.dto';

/** Family-plan alignment for a per-student charge schedule (shared cadence + due dates). */
interface FamilyPlanOverride {
  financialPlanId: string;
  installments: number;
  firstDueDate: Date;
}

/**
 * Admissions data layer (Phase 22). Tenant-scoped, RLS-enforced, audited. The registration commit
 * runs as a single transaction creating Student → Parent → link → Enrollment → Charges/installments
 * → fee-modification tracking → StudentBillingProfile badge → RegistrationCommitment (idempotent).
 * Reuses the existing ledger tables; never duplicates Charge/Transaction logic.
 */
@Injectable()
export class AdmissionsRepository extends TenantRepository {
  constructor(
    prisma: PrismaService,
    connections: TenantConnectionManager,
    private readonly accounts: AccountRepository,
    private readonly financialAccounts: FinancialAccountRepository,
    private readonly schedule: InstallmentScheduleService,
  ) {
    super(prisma, connections);
  }

  private actor(): string | null {
    return TenantContextStore.get()?.actorUserId ?? null;
  }

  /** The campus a student attends in a given Academic Year, for the Enrollment's year-scoped placement. */
  private async yearCampusId(tx: TxClient, academicYearId: string): Promise<string | null> {
    const ay = await tx.academicYear.findUnique({
      where: { id: academicYearId },
      select: { campusId: true },
    });
    return ay?.campusId ?? null;
  }

  /**
   * THE single place an Enrollment row is created (Decision 3 — one pipeline for admission,
   * re-enrollment, promotion and repeat). Resolves the year's campus, writes the year-scoped placement
   * (Decisions 4 & 13), and stamps the workflow (`admissionStatus`) + participation (`status`) split
   * (Decision 2). Charge/plan generation stays with `createEnrollmentCharges`; callers compose the two.
   */
  private async createEnrollmentRowTx(
    tx: TxClient,
    tenantId: string,
    params: {
      studentId: string;
      academicYearId: string;
      gradeId: string;
      sectionId?: string | null;
      classroomId?: string | null;
      areaId?: string | null;
      transportRequested?: boolean;
      quoteId?: string | null;
      transportDirection?: TransportDirection;
      paymentMode: QuotePaymentMode;
      feeModified?: boolean;
      registrationFeePaid?: boolean;
      // The admission workflow status this enrollment is born at: REGISTERED (finalised) or ACCEPTED
      // (held pending finance approval). Participation `status` is ACTIVE either way.
      admissionStatus: AdmissionStatus;
      admissionDate?: Date;
    },
  ) {
    // Guard 1 — one enrollment per (student, academic year). Surface a clear, actionable reason
    // instead of the raw unique-index violation (P2002 → "record already exists") when the student
    // already has an enrollment for this year — e.g. a WITHDRAWN one. Re-admission into the SAME year
    // must reactivate that enrollment, not duplicate it.
    const existingForYear = await tx.enrollment.findFirst({
      where: { studentId: params.studentId, academicYearId: params.academicYearId },
      select: { status: true, academicYear: { select: { name: true } } },
    });
    if (existingForYear) {
      const yearName = existingForYear.academicYear?.name ?? 'this academic year';
      throw new BadRequestException(
        `This student is already enrolled in Academic Year ${yearName} ` +
          `(status: ${existingForYear.status.toLowerCase()}). Open the student's Current Enrollment to ` +
          `correct or reactivate it instead of creating a new admission for the same year.`,
      );
    }

    // Guard 2 — grade regression. A returning student may repeat (same level) or advance, but must
    // never be placed in a LOWER grade than their most recent finalised enrollment. Block with the
    // reason so the registrar understands why (Decision — historical placement is authoritative).
    const targetGrade = await tx.grade.findFirst({
      where: { id: params.gradeId },
      select: { level: true, nameEn: true },
    });
    const priorEnrollment = await tx.enrollment.findFirst({
      where: { studentId: params.studentId, admissionStatus: AdmissionStatus.REGISTERED },
      orderBy: [{ academicYear: { startDate: 'desc' } }, { createdAt: 'desc' }],
      select: { grade: { select: { level: true, nameEn: true } } },
    });
    if (targetGrade && priorEnrollment?.grade && targetGrade.level < priorEnrollment.grade.level) {
      throw new BadRequestException(
        `Cannot enrol in ${targetGrade.nameEn} — the student's most recent grade is ` +
          `${priorEnrollment.grade.nameEn}. A student cannot be placed in a lower grade than before.`,
      );
    }

    const campusId = await this.yearCampusId(tx, params.academicYearId);
    const admissionDate = params.admissionDate ?? new Date();
    const enrollment = await tx.enrollment.create({
      data: {
        tenantId,
        studentId: params.studentId,
        academicYearId: params.academicYearId,
        gradeId: params.gradeId,
        ...(params.sectionId ? { sectionId: params.sectionId } : {}),
        ...(params.classroomId ? { classroomId: params.classroomId } : {}),
        // Year-scoped placement lives on the Enrollment (Decisions 4 & 13).
        ...(campusId ? { campusId } : {}),
        ...(params.areaId ? { areaId: params.areaId } : {}),
        ...(params.transportRequested !== undefined
          ? { transportRequested: params.transportRequested }
          : {}),
        admissionDate,
        ...(params.quoteId ? { quoteId: params.quoteId } : {}),
        transportDirection: params.transportDirection ?? TransportDirection.NONE,
        // Decision 2: admission workflow (`admissionStatus`) vs. participation (`status`) are separate;
        // the authoritative "finalised" gate is admissionStatus === REGISTERED.
        admissionStatus: params.admissionStatus,
        status: EnrollmentStatus.ACTIVE,
        paymentMode: params.paymentMode,
        feeModified: params.feeModified ?? false,
        registrationFeePaid: params.registrationFeePaid ?? true,
        createdById: this.actor(),
      },
    });

    // Enrollment is the ONLY source of truth for placement. The deprecated Student.* placement columns
    // are a read-through cache for legacy readers during the transition (dropped in Phase B) and are
    // written ONLY here (creation) and by EnrollmentLifecycle/EnrollmentChange — never by callers.
    await this.syncStudentPlacementShim(tx, params.studentId, {
      sectionId: params.sectionId ?? null,
      areaId: params.areaId ?? null,
      transportRequested: params.transportRequested,
      enrollmentDate: admissionDate,
    });
    return enrollment;
  }

  /**
   * Sync the DEPRECATED Student placement shims from the authoritative Enrollment (read-through cache,
   * single-writer). See ADR-0001. Removed in Phase B once every reader uses the Enrollment.
   */
  private syncStudentPlacementShim(
    tx: TxClient,
    studentId: string,
    p: {
      sectionId?: string | null;
      areaId?: string | null;
      transportRequested?: boolean;
      enrollmentDate?: Date;
    },
  ) {
    return tx.student.update({
      where: { id: studentId },
      data: {
        sectionId: p.sectionId ?? null,
        areaId: p.areaId ?? null,
        ...(p.transportRequested !== undefined ? { transportRequested: p.transportRequested } : {}),
        ...(p.enrollmentDate ? { enrollmentDate: p.enrollmentDate } : {}),
      },
    });
  }

  // ── Fee recalculation after a grade correction (PR 2, ADR-0001 + finance guardrails) ──
  /**
   * Context for the fee comparison / re-quote of an enrollment's current grade. `currentAdjustable` is
   * the net of ACTIVE, fully-unpaid, non-registration charges — the ONLY amount recalculation may
   * touch. `locked` is everything paid/partial + the one-time registration fee (never modified). The
   * cadence params (installments / firstDueDate) are read from the existing tuition plan so the
   * re-quote keeps the same schedule shape.
   */
  recalcContext(enrollmentId: string) {
    return this.run(async (tx) => {
      const e = await tx.enrollment.findFirst({
        where: { id: enrollmentId },
        select: { studentId: true, academicYearId: true, gradeId: true, paymentMode: true },
      });
      if (!e) throw new BadRequestException('Enrollment not found');

      const charges = await tx.charge.findMany({
        where: { enrollmentId, status: { not: ChargeStatus.CANCELLED } },
        select: {
          id: true,
          amount: true,
          description: true,
          feeItem: { select: { kind: true } },
          installments: { select: { status: true } },
        },
      });
      const isSettled = (s: string) => s === 'PAID' || s === 'PARTIAL';
      let adjustable = new Prisma.Decimal(0);
      let locked = new Prisma.Decimal(0);
      let registrationAmount = new Prisma.Decimal(0);
      let replaceCount = 0;
      let keepCount = 0;
      const existingCharges = charges.map((c) => {
        const settled = c.installments.some((i) => isSettled(i.status));
        const willReplace = c.description === 'Tuition & fees' && !settled;
        if (willReplace) {
          adjustable = adjustable.plus(c.amount);
          replaceCount += 1;
        } else {
          locked = locked.plus(c.amount);
          keepCount += 1;
        }
        const isReg =
          c.feeItem?.kind === FeeItemKind.REGISTRATION || c.description === 'Registration fee';
        if (isReg) registrationAmount = registrationAmount.plus(c.amount);
        return {
          description: c.description,
          amount: c.amount.toFixed(3),
          paid: settled,
          willReplace,
        };
      });

      const tuition = await tx.charge.findFirst({
        where: {
          enrollmentId,
          status: { not: ChargeStatus.CANCELLED },
          description: 'Tuition & fees',
        },
        select: { id: true },
      });
      const plan = tuition
        ? await tx.paymentPlan.findFirst({
            where: { chargeId: tuition.id, status: 'ACTIVE' },
            select: { installments: true, firstDueDate: true },
          })
        : null;

      // The grade the current charges were priced for (the grade BEFORE the correction) — read from the
      // most recent grade-correction audit so the impact screen shows "previous grade → new grade".
      const lastCorrection = await tx.auditLog.findFirst({
        where: {
          entityType: 'Enrollment',
          entityId: enrollmentId,
          action: 'enrollment.gradeCorrection',
        },
        orderBy: { createdAt: 'desc' },
        select: { metadata: true },
      });
      const previousGradeId =
        (lastCorrection?.metadata as { fromGradeId?: string } | null)?.fromGradeId ?? null;
      const gradeIds = [e.gradeId, ...(previousGradeId ? [previousGradeId] : [])];
      const gradeRows = await tx.grade.findMany({
        where: { id: { in: gradeIds } },
        select: { id: true, nameEn: true },
      });
      const gradeName = (id: string | null) =>
        id ? (gradeRows.find((g) => g.id === id)?.nameEn ?? null) : null;

      return {
        studentId: e.studentId,
        academicYearId: e.academicYearId,
        gradeId: e.gradeId,
        paymentMode: e.paymentMode,
        installments: plan?.installments ?? 1,
        firstDueDate: plan?.firstDueDate ? plan.firstDueDate.toISOString().slice(0, 10) : null,
        currentAdjustable: adjustable.toFixed(3),
        locked: locked.toFixed(3),
        registrationAmount: registrationAmount.toFixed(3),
        replaceCount,
        keepCount,
        existingCharges,
        previousGradeId,
        previousGradeName: gradeName(previousGradeId),
        newGradeName: gradeName(e.gradeId),
      };
    });
  }

  /**
   * Re-price the grade-dependent tuition for an enrollment after a grade correction, using a freshly
   * computed quote. Cancels ONLY the fully-unpaid, non-registration charges (paid/partial charges,
   * verified payments and the registration fee are never touched — the ledger stays the source of
   * truth) and regenerates the "Tuition & fees" charge + plan for the new grade. Fully audited.
   */
  replaceTuitionForGrade(
    enrollmentId: string,
    computed: ComputedQuote,
    report: {
      previousGradeId: string | null;
      previousGradeName: string | null;
      newGradeName: string | null;
    },
  ) {
    return this.run(async (tx, tenantId) => {
      const e = await tx.enrollment.findFirst({
        where: { id: enrollmentId },
        select: { studentId: true, academicYearId: true, gradeId: true },
      });
      if (!e) throw new BadRequestException('Enrollment not found');

      const charges = await tx.charge.findMany({
        where: { enrollmentId, status: { not: ChargeStatus.CANCELLED } },
        select: {
          id: true,
          description: true,
          amount: true,
          installments: { select: { status: true } },
        },
      });
      const isSettled = (s: string) => s === 'PAID' || s === 'PARTIAL';
      const cancelledChargeIds: string[] = [];
      const previousCharges: Array<{ description: string; amount: string }> = [];
      let previousTuition = new Prisma.Decimal(0);
      for (const c of charges) {
        if (c.description !== 'Tuition & fees') continue; // only the grade-dependent tuition is re-priced
        if (c.installments.some((i) => isSettled(i.status))) continue; // has a payment — never touched
        previousCharges.push({ description: c.description, amount: c.amount.toFixed(3) });
        previousTuition = previousTuition.plus(c.amount);
        await tx.charge.update({ where: { id: c.id }, data: { status: ChargeStatus.CANCELLED } });
        await tx.installment.updateMany({
          where: { chargeId: c.id, status: { notIn: ['PAID', 'PARTIAL'] } },
          data: { status: 'CANCELLED' },
        });
        await tx.paymentPlan.updateMany({
          where: { chargeId: c.id, status: 'ACTIVE' },
          data: { status: 'CANCELLED' },
        });
        cancelledChargeIds.push(c.id);
      }

      const registrationNet = computed.lines
        .filter((l) => l.kind === FeeItemKind.REGISTRATION)
        .reduce(
          (sum, l) => sum.plus(new Prisma.Decimal(l.amount).minus(l.discountAmount)),
          new Prisma.Decimal(0),
        );
      const remainder = new Prisma.Decimal(computed.grandTotal).minus(registrationNet);
      let newChargeId: string | null = null;
      if (remainder.greaterThan(0)) {
        const account = await this.accounts.ensureAccountTx(tx, tenantId, e.studentId);
        const installments =
          computed.paymentMode === QuotePaymentMode.FULL ? 1 : computed.installments;
        const firstDue = computed.firstDueDate ? new Date(computed.firstDueDate) : new Date();
        const charge = await tx.charge.create({
          data: {
            tenantId,
            studentId: e.studentId,
            accountId: account.id,
            academicYearId: e.academicYearId,
            gradeId: e.gradeId,
            enrollmentId,
            description: 'Tuition & fees',
            amount: remainder,
            dueDate: firstDue,
            status: ChargeStatus.PENDING,
            createdById: this.actor(),
          },
        });
        newChargeId = charge.id;
        const lines = this.schedule.generate(toFils(remainder.toFixed(3)), {
          cadence: 'MONTHLY',
          installments,
          firstDueDate: firstDue.toISOString().slice(0, 10),
        });
        const plan = await tx.paymentPlan.create({
          data: {
            tenantId,
            chargeId: charge.id,
            cadence: 'MONTHLY',
            installments,
            firstDueDate: firstDue,
            createdById: this.actor(),
          },
        });
        for (const line of lines) {
          await tx.installment.create({
            data: {
              tenantId,
              chargeId: charge.id,
              planId: plan.id,
              seq: line.seq,
              dueDate: line.dueDate,
              amount: fromFils(line.amountFils),
            },
          });
        }
      }

      // Financial Impact Report (ADR-0001) — a complete, self-explaining record of WHY the student's
      // financial obligations changed. writeAudit stamps the actor (user) + timestamp (date/time).
      const amountDifference = remainder.minus(previousTuition).toFixed(3);
      await this.writeAudit(tx, tenantId, {
        action: 'finance.gradeRecalculation',
        entityType: 'Enrollment',
        entityId: enrollmentId,
        metadata: {
          report: 'Financial Impact Report',
          previousGradeId: report.previousGradeId,
          newGradeId: e.gradeId,
          previousGradeName: report.previousGradeName,
          newGradeName: report.newGradeName,
          previousCharges,
          newCharges: newChargeId
            ? [{ description: 'Tuition & fees', amount: remainder.toFixed(3) }]
            : [],
          previousTuition: previousTuition.toFixed(3),
          newTuition: remainder.toFixed(3),
          amountDifference,
          cancelledChargeIds,
          newChargeId,
        },
      });
      return {
        cancelledChargeIds,
        newChargeId,
        newTuition: remainder.toFixed(3),
        amountDifference,
      };
    });
  }

  // ── Fee-item catalog ──
  listFeeItems() {
    return this.run((tx) => tx.feeItem.findMany({ orderBy: [{ kind: 'asc' }, { nameEn: 'asc' }] }));
  }

  createFeeItem(dto: CreateFeeItemDto) {
    return this.run(async (tx, tenantId) => {
      const row = await tx.feeItem.create({
        data: {
          tenantId,
          kind: dto.kind,
          nameEn: dto.nameEn,
          nameAr: dto.nameAr,
          mandatory: dto.mandatory ?? false,
          discountable: dto.discountable ?? false,
          createdById: this.actor(),
          updatedById: this.actor(),
        },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'admissions.feeItem.create',
        entityType: 'FeeItem',
        entityId: row.id,
        metadata: { kind: row.kind, nameEn: row.nameEn },
      });
      return row;
    });
  }

  updateFeeItem(id: string, dto: UpdateFeeItemDto) {
    return this.run(async (tx, tenantId) => {
      const row = await tx.feeItem.update({
        where: { id },
        data: {
          ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn } : {}),
          ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr } : {}),
          ...(dto.mandatory !== undefined ? { mandatory: dto.mandatory } : {}),
          ...(dto.discountable !== undefined ? { discountable: dto.discountable } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          updatedById: this.actor(),
        },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'admissions.feeItem.update',
        entityType: 'FeeItem',
        entityId: id,
      });
      return row;
    });
  }

  listGradeFeeItems(academicYearId: string, gradeId?: string) {
    return this.run((tx) =>
      tx.gradeFeeItem.findMany({
        where: { academicYearId, ...(gradeId ? { gradeId } : {}) },
        include: { feeItem: true },
        orderBy: [{ effectiveFrom: 'desc' }],
      }),
    );
  }

  /** Active grade-fee lines effective today (one current line per fee item). */
  async listActiveGradeFeeItems(academicYearId: string, gradeId: string) {
    const rows = await this.run((tx) =>
      tx.gradeFeeItem.findMany({
        where: { academicYearId, gradeId, isActive: true },
        include: { feeItem: true },
        orderBy: [{ effectiveFrom: 'desc' }],
      }),
    );
    const today = new Date();
    const current = rows.filter(
      (r) => r.effectiveFrom <= today && (r.effectiveTo === null || r.effectiveTo >= today),
    );
    const seen = new Set<string>();
    const out: typeof current = [];
    for (const r of current) {
      if (seen.has(r.feeItemId)) continue;
      seen.add(r.feeItemId);
      out.push(r);
    }
    return out;
  }

  upsertGradeFeeItem(dto: UpsertGradeFeeItemDto) {
    return this.run(async (tx, tenantId) => {
      const item = await tx.feeItem.findFirst({
        where: { id: dto.feeItemId },
        select: { id: true },
      });
      if (!item) throw new BadRequestException('Fee item not found in this tenant');
      // Supersede any current active line for this item/grade/year (effective dating).
      await tx.gradeFeeItem.updateMany({
        where: {
          feeItemId: dto.feeItemId,
          gradeId: dto.gradeId,
          academicYearId: dto.academicYearId,
          isActive: true,
        },
        data: { isActive: false, effectiveTo: new Date(), updatedById: this.actor() },
      });
      const row = await tx.gradeFeeItem.create({
        data: {
          tenantId,
          feeItemId: dto.feeItemId,
          gradeId: dto.gradeId,
          academicYearId: dto.academicYearId,
          amount: new Prisma.Decimal(dto.amount),
          mandatory: dto.mandatory ?? false,
          discountable: dto.discountable ?? false,
          effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
          createdById: this.actor(),
          updatedById: this.actor(),
        },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'admissions.gradeFeeItem.upsert',
        entityType: 'GradeFeeItem',
        entityId: row.id,
        metadata: { amount: row.amount.toString() },
      });
      return row;
    });
  }

  findAcademicYear(id: string) {
    return this.run((tx) =>
      tx.academicYear.findFirst({ where: { id }, select: { id: true, endDate: true } }),
    );
  }

  // ── Quotes ──
  createQuote(computed: ComputedQuote, overrides: FeeOverrideDto[]) {
    return this.run(async (tx, tenantId) => {
      const quote = await tx.enrollmentQuote.create({
        data: {
          tenantId,
          academicYearId: computed.academicYearId,
          gradeId: computed.gradeId,
          studentId: computed.studentId,
          transportDirection: computed.transportDirection,
          paymentMode: computed.paymentMode,
          installments: computed.installments,
          firstDueDate: computed.firstDueDate ? new Date(computed.firstDueDate) : null,
          totalFees: new Prisma.Decimal(computed.totalFees),
          discountEligible: new Prisma.Decimal(computed.discountEligible),
          discountAmount: new Prisma.Decimal(computed.discountAmount),
          nonDiscountEligible: new Prisma.Decimal(computed.nonDiscountEligible),
          grandTotal: new Prisma.Decimal(computed.grandTotal),
          feeModified: computed.feeModified,
          createdById: this.actor(),
          items: {
            create: computed.lines.map((l) => ({
              tenantId,
              feeItemId: l.feeItemId,
              kind: l.kind,
              label: l.label,
              amount: new Prisma.Decimal(l.amount),
              discountable: l.discountable,
              discountAmount: new Prisma.Decimal(l.discountAmount),
              overridden: l.overridden,
              originalAmount: l.originalAmount ? new Prisma.Decimal(l.originalAmount) : null,
              overrideReason: l.overridden
                ? (overrides.find((o) => o.kind === l.kind)?.reason ?? 'Registrar override')
                : null,
            })),
          },
        },
        include: { items: true },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'admissions.quote.create',
        entityType: 'EnrollmentQuote',
        entityId: quote.id,
        metadata: { grandTotal: quote.grandTotal.toString(), feeModified: quote.feeModified },
      });
      return quote;
    });
  }

  getQuote(id: string) {
    return this.run((tx) =>
      tx.enrollmentQuote.findFirst({ where: { id }, include: { items: true } }),
    );
  }

  // ── Atomic registration commit ──
  // Creates the ledger charges for a committed enrollment. Full payment = one charge per fee
  // line (net of discount); installments = the grand total split into N monthly charges sharing
  // one plan group. Called at commit time for unmodified fees, or at approval time once a held
  // (fee-modified) enrollment is approved.
  /**
   * Materialise the AR ledger for a committed enrollment on the new model (ADR-001):
   *   FULL  → one Charge per fee line (net of discount), each with an implicit single installment.
   *   INSTALLMENTS → a one-time "Registration fee" Charge (due at registration, never spread), plus
   *                  one "Tuition & fees" Charge for the REMAINING net + a PaymentPlan whose N
   *                  monthly installments sum exactly to that remainder (shared schedule generator).
   * The registration fee is a one-off obligation payable when the student registers, so it is carved
   * out of the amount that gets divided into monthly installments (BR: registration is paid once).
   * Every charge is linked to the account + enrollment + academic-year/grade dimensions (RR-2).
   */
  private async createEnrollmentCharges(
    tx: TxClient,
    tenantId: string,
    studentId: string,
    enrollmentId: string,
    quote: Prisma.EnrollmentQuoteGetPayload<{ include: { items: true } }>,
    registrationFeePaid = true,
    // When the enrollment is billed through a FinancialAccount, its tuition plan is aligned to the
    // FAMILY plan (shared cadence + installment count + first due date) and linked via financialPlanId,
    // so every child's schedule lands on the same due dates → exactly N family installments.
    familyPlan?: FamilyPlanOverride,
  ) {
    const account = await this.accounts.ensureAccountTx(tx, tenantId, studentId);
    const dims = {
      accountId: account.id,
      academicYearId: quote.academicYearId,
      gradeId: quote.gradeId,
      enrollmentId,
    };
    const dueDate = familyPlan ? familyPlan.firstDueDate : (quote.firstDueDate ?? null);

    if (quote.paymentMode === QuotePaymentMode.FULL) {
      for (const item of quote.items) {
        const net = item.amount.minus(item.discountAmount);
        if (net.lessThanOrEqualTo(0)) continue;
        const charge = await tx.charge.create({
          data: {
            tenantId,
            studentId,
            ...dims,
            feeItemId: item.feeItemId ?? null,
            description: item.label,
            amount: net,
            dueDate,
            status: ChargeStatus.PENDING,
            createdById: this.actor(),
          },
        });
        await tx.installment.create({
          data: { tenantId, chargeId: charge.id, seq: 1, dueDate, amount: net },
        });
      }
      return;
    }

    // INSTALLMENTS. When the registration fee was paid at registration (the usual case), carve it out
    // as its own one-off charge due at registration — it is never divided across the monthly plan, so
    // only the remaining fees are scheduled. When it was NOT paid up front, it stays folded into the
    // grand total and is spread across the installments like any other fee (registrationNet = 0 here).
    const registrationNet = registrationFeePaid
      ? quote.items
          .filter((it) => it.kind === FeeItemKind.REGISTRATION)
          .reduce((sum, it) => sum.plus(it.amount.minus(it.discountAmount)), new Prisma.Decimal(0))
      : new Prisma.Decimal(0);
    if (registrationNet.greaterThan(0)) {
      const regDue = new Date(); // payable once, at the moment of registration
      const regCharge = await tx.charge.create({
        data: {
          tenantId,
          studentId,
          ...dims,
          description: 'Registration fee',
          amount: registrationNet,
          dueDate: regDue,
          status: ChargeStatus.PENDING,
          createdById: this.actor(),
        },
      });
      await tx.installment.create({
        data: {
          tenantId,
          chargeId: regCharge.id,
          seq: 1,
          dueDate: regDue,
          amount: registrationNet,
        },
      });
    }

    // The remaining net (grand total minus the registration fee) is what gets spread over the plan.
    const remainder = quote.grandTotal.minus(registrationNet);
    if (remainder.lessThanOrEqualTo(0)) return; // registration-only quote — nothing left to schedule

    const charge = await tx.charge.create({
      data: {
        tenantId,
        studentId,
        ...dims,
        description: 'Tuition & fees',
        amount: remainder,
        dueDate,
        status: ChargeStatus.PENDING,
        createdById: this.actor(),
      },
    });
    // Family-billed charges follow the FAMILY plan's count + first due date so every child's schedule
    // aligns; standalone charges use the quote's own values (unchanged legacy behaviour).
    const planInstallments = familyPlan ? familyPlan.installments : quote.installments;
    const planFirstDue = familyPlan ? familyPlan.firstDueDate : (quote.firstDueDate ?? new Date());
    const first = planFirstDue.toISOString().slice(0, 10);
    const lines = this.schedule.generate(toFils(remainder.toFixed(3)), {
      cadence: 'MONTHLY',
      installments: planInstallments,
      firstDueDate: first,
    });
    const plan = await tx.paymentPlan.create({
      data: {
        tenantId,
        chargeId: charge.id,
        ...(familyPlan ? { financialPlanId: familyPlan.financialPlanId } : {}),
        cadence: 'MONTHLY',
        installments: planInstallments,
        firstDueDate: planFirstDue,
        createdById: this.actor(),
      },
    });
    for (const line of lines) {
      await tx.installment.create({
        data: {
          tenantId,
          chargeId: charge.id,
          planId: plan.id,
          seq: line.seq,
          dueDate: line.dueDate,
          amount: fromFils(line.amountFils),
        },
      });
    }
  }

  // ── Registration commit (single student = the N=1 case of the account commit) ──
  /**
   * Commit a single-student registration. This is a thin adapter over {@link familyCommit}: it
   * resolves the guardian (from the request, or the returning student's primary guardian), reads the
   * plan parameters from the quote, and commits exactly one student — so EVERY new admission creates a
   * Financial Account (Payer) and a single unified write path handles one or many students. Returns
   * the created enrollment (unchanged contract for existing callers).
   */
  async commit(dto: CommitDto) {
    const quote = await this.run((tx) =>
      tx.enrollmentQuote.findFirst({
        where: { id: dto.quoteId },
        select: {
          academicYearId: true,
          paymentMode: true,
          installments: true,
          firstDueDate: true,
        },
      }),
    );
    if (!quote) throw new BadRequestException('Quote not found');

    // Resolve the guardian: given explicitly, or (returning student) their primary guardian.
    let existingParentId = dto.existingParentId;
    if (!existingParentId && !dto.parent && dto.existingStudentId) {
      const link = await this.run((tx) =>
        tx.parentStudent.findFirst({
          where: { studentId: dto.existingStudentId },
          orderBy: { isPrimary: 'desc' },
          select: { parentId: true },
        }),
      );
      existingParentId = link?.parentId;
    }

    const result = await this.familyCommit({
      idempotencyKey: dto.idempotencyKey,
      academicYearId: quote.academicYearId,
      ...(existingParentId ? { existingParentId } : {}),
      ...(dto.parent ? { parent: dto.parent } : {}),
      ownerType: FinancialAccountOwnerType.GUARDIAN,
      paymentMode: quote.paymentMode,
      installments: quote.installments,
      ...(quote.firstDueDate
        ? { firstDueDate: quote.firstDueDate.toISOString().slice(0, 10) }
        : {}),
      registrationFeePaid: dto.registrationFeePaid ?? true,
      students: [
        {
          quoteId: dto.quoteId,
          ...(dto.existingStudentId ? { existingStudentId: dto.existingStudentId } : {}),
          ...(dto.student ? { student: dto.student } : {}),
          ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
          ...(dto.busRouteId ? { busRouteId: dto.busRouteId } : {}),
          ...(dto.busTripRound ? { busTripRound: dto.busTripRound } : {}),
          ...(dto.areaId ? { areaId: dto.areaId } : {}),
          ...(dto.transportRequested !== undefined
            ? { transportRequested: dto.transportRequested }
            : {}),
        },
      ],
    });

    const enrollmentId = result.enrollmentIds[0];
    if (!enrollmentId) throw new BadRequestException('Commit produced no enrollment');
    return this.run((tx) => tx.enrollment.findFirstOrThrow({ where: { id: enrollmentId } }));
  }

  // ── Atomic account registration commit (the single canonical write path) ──
  /**
   * Register one or more students under one Financial Account (Payer) in a single transaction. Creates
   * — for each student — Student → guardian link → Enrollment → per-student Charges, all aligned to ONE
   * account FinancialAccountPlan (shared cadence + installment count + first due date), so a chosen "9
   * installments" yields exactly 9 account installments. Students remain the owners of their charges;
   * the account owns the plan/payments. Single-student admission is the N=1 case (see {@link commit}).
   * Idempotent per student (keyed `<idempotencyKey>:<index>`). Fee overrides are recorded and, when the
   * tenant requires finance approval, hold that student's enrollment in PENDING_APPROVAL (charges
   * deferred until approval — see decideModification); otherwise auto-approved.
   */
  async familyCommit(dto: FamilyCommitDto) {
    return this.run(async (tx, tenantId) => {
      if (!dto.students || dto.students.length === 0) {
        throw new BadRequestException('At least one student is required');
      }

      // Idempotency: a prior family commit with the same key returns the same account + enrollments.
      const firstKey = `${dto.idempotencyKey}:0`;
      const prior = await tx.registrationCommitment.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: firstKey } },
      });
      if (prior) return this.loadFamilyResult(tx, dto.idempotencyKey);

      // 1) Guardian — link an existing parent or create a new one (dedup by mobile).
      const relation = dto.parent?.relation ?? ParentRelation.GUARDIAN;
      let parentId: string;
      if (dto.existingParentId) {
        const chosen = await tx.parent.findFirst({
          where: { id: dto.existingParentId, tenantId, deletedAt: null },
          select: { id: true },
        });
        if (!chosen)
          throw new BadRequestException('The selected guardian was not found in this tenant');
        parentId = chosen.id;
      } else {
        if (!dto.parent) throw new BadRequestException('A guardian is required');
        if (!dto.parent.phone?.trim())
          throw new BadRequestException('A guardian mobile number is required');
        const p = dto.parent;
        const existingParent = await tx.parent.findFirst({
          where: { tenantId, phone: p.phone, deletedAt: null },
          select: { id: true },
        });
        parentId =
          existingParent?.id ??
          (
            await tx.parent.create({
              data: {
                tenantId,
                firstNameEn: p.firstNameEn,
                lastNameEn: p.lastNameEn,
                firstNameAr: p.firstNameAr || p.firstNameEn,
                lastNameAr: p.lastNameAr || p.lastNameEn,
                phone: p.phone,
                ...(p.phoneAlt ? { phoneAlt: p.phoneAlt } : {}),
                ...(p.email ? { email: p.email } : {}),
              },
              select: { id: true },
            })
          ).id;
      }

      // 2) The financial customer (find-or-create Payer) + 3) the ONE account payment plan.
      const financialAccount = await this.financialAccounts.ensureForParentTx(
        tx,
        tenantId,
        parentId,
        dto.ownerType ?? 'GUARDIAN',
      );
      const firstDue = dto.firstDueDate ? new Date(dto.firstDueDate) : new Date();
      const installments = dto.paymentMode === QuotePaymentMode.FULL ? 1 : (dto.installments ?? 1);
      const familyPlan = await tx.financialAccountPlan.create({
        data: {
          tenantId,
          payerId: financialAccount.id,
          academicYearId: dto.academicYearId,
          cadence: 'MONTHLY',
          installments,
          firstDueDate: firstDue,
          createdById: this.actor(),
        },
      });
      const planOverride: FamilyPlanOverride = {
        financialPlanId: familyPlan.id,
        installments,
        firstDueDate: firstDue,
      };

      // A fee change only holds an enrollment in PENDING_APPROVAL when the tenant opts into the
      // finance-approval workflow (default off); the account + plan are created regardless, and the
      // held student's charges are deferred until approval (see decideModification).
      const policy = await tx.billingPolicy.findUnique({
        where: { tenantId },
        select: { requireFinanceApprovalForFeeChanges: true },
      });
      const requireApproval = policy?.requireFinanceApprovalForFeeChanges ?? false;

      // 4) Each student: resolve/create, link the guardian, enroll, and bill through the account plan.
      const enrollmentIds: string[] = [];
      for (const [i, entry] of dto.students.entries()) {
        const quote = await tx.enrollmentQuote.findFirst({
          where: { id: entry.quoteId },
          include: { items: true },
        });
        if (!quote) throw new BadRequestException(`Quote not found for student #${i + 1}`);
        if (quote.items.length === 0)
          throw new BadRequestException(`Quote #${i + 1} has no fee lines`);
        if (quote.academicYearId !== dto.academicYearId) {
          throw new BadRequestException(`Quote #${i + 1} is for a different academic year`);
        }

        let studentId = entry.existingStudentId ?? null;
        if (!studentId) {
          if (!entry.student)
            throw new BadRequestException(`Student #${i + 1} information is required`);
          const s = entry.student;
          const studentNumber = await allocateStudentNumber(tx, tenantId);
          const created = await tx.student.create({
            data: {
              tenantId,
              studentNumber,
              firstNameEn: s.firstNameEn,
              lastNameEn: s.lastNameEn,
              firstNameAr: s.firstNameAr || s.firstNameEn,
              lastNameAr: s.lastNameAr || s.lastNameEn,
              ...(s.gender ? { gender: s.gender } : {}),
              ...(s.dateOfBirth ? { dateOfBirth: new Date(s.dateOfBirth) } : {}),
              ...(s.nationalId ? { nationalId: s.nationalId } : {}),
              // Identity only — placement (section/area/transport) is set on the Enrollment and
              // cached to the Student shim by createEnrollmentRowTx (ADR-0001). Never set here.
              status: StudentStatus.ACTIVE,
              qrCode: generateStudentQrCode(),
            },
            select: { id: true },
          });
          studentId = created.id;
        }
        // A returning student is NOT edited for placement — the new-year Enrollment carries it.

        // Link the guardian (skip if already linked). The first student's guardian is primary.
        const existingLink = await tx.parentStudent.findFirst({
          where: { tenantId, parentId, studentId },
          select: { id: true },
        });
        if (!existingLink) {
          await tx.parentStudent.create({
            data: { tenantId, parentId, studentId, relation, isPrimary: true },
          });
        }

        const held = quote.feeModified && requireApproval;
        const enrollment = await this.createEnrollmentRowTx(tx, tenantId, {
          studentId,
          academicYearId: quote.academicYearId,
          gradeId: quote.gradeId,
          sectionId: entry.sectionId ?? null,
          areaId: entry.areaId ?? null,
          ...(entry.transportRequested !== undefined
            ? { transportRequested: entry.transportRequested }
            : {}),
          quoteId: quote.id,
          transportDirection: quote.transportDirection,
          paymentMode: dto.paymentMode,
          feeModified: quote.feeModified,
          registrationFeePaid: dto.registrationFeePaid ?? true,
          admissionStatus: held ? AdmissionStatus.ACCEPTED : AdmissionStatus.REGISTERED,
        });

        // Link the student's AR account to the account (Payer), then bill it through the account plan.
        // When held for finance approval, charge creation is deferred until approval so nothing
        // financial is committed before the decision (charges are aligned to the plan at approval).
        const account = await this.accounts.ensureAccountTx(tx, tenantId, studentId);
        await this.financialAccounts.linkStudentAccountTx(tx, account.id, financialAccount.id);
        if (!held) {
          await this.createEnrollmentCharges(
            tx,
            tenantId,
            studentId,
            enrollment.id,
            quote,
            dto.registrationFeePaid ?? true,
            planOverride,
          );
        }

        // Fee-modification tracking. Held → PENDING (surfaces in the finance approval inbox);
        // otherwise auto-approved (decided now by the committing actor) so history is preserved.
        const decidedNow = new Date();
        for (const item of quote.items) {
          if (!item.overridden || item.originalAmount === null) continue;
          const mod = await tx.feeModification.create({
            data: {
              tenantId,
              enrollmentId: enrollment.id,
              studentId,
              field: item.kind,
              originalValue: item.originalAmount.toFixed(3),
              newValue: item.amount.toFixed(3),
              difference: item.amount.minus(item.originalAmount).toFixed(3),
              reason: item.overrideReason ?? 'Registrar override',
              modifiedById: this.actor(),
            },
          });
          await tx.feeModificationApproval.create({
            data: held
              ? { tenantId, modificationId: mod.id, status: ApprovalStatus.PENDING }
              : {
                  tenantId,
                  modificationId: mod.id,
                  status: ApprovalStatus.APPROVED,
                  approverId: this.actor(),
                  decidedAt: decidedNow,
                  note: 'Auto-approved: tenant does not require finance approval for fee changes',
                },
          });
        }
        if (quote.feeModified) {
          await tx.studentBillingProfile.upsert({
            where: { studentId },
            create: { tenantId, studentId, feeModified: true },
            update: { feeModified: true },
          });
        }

        // Bus route assignment (mirror the admission choice into the fleet).
        if (entry.busRouteId) {
          const route = await tx.busRoute.findFirst({
            where: { id: entry.busRouteId, deletedAt: null },
            select: { id: true },
          });
          if (!route) throw new BadRequestException('Bus route not found in this tenant');
          const existingAssignment = await tx.studentBusAssignment.findFirst({
            where: { studentId },
          });
          if (existingAssignment) {
            await tx.studentBusAssignment.update({
              where: { id: existingAssignment.id },
              data: {
                routeId: entry.busRouteId,
                stopId: null,
                tripRound: entry.busTripRound ?? null,
              },
            });
          } else {
            await tx.studentBusAssignment.create({
              data: {
                tenantId,
                studentId,
                routeId: entry.busRouteId,
                tripRound: entry.busTripRound ?? null,
              },
            });
          }
        }

        await tx.registrationCommitment.create({
          data: {
            tenantId,
            enrollmentId: enrollment.id,
            studentId,
            idempotencyKey: `${dto.idempotencyKey}:${i}`,
            committedById: this.actor(),
          },
        });
        enrollmentIds.push(enrollment.id);
      }

      await this.writeAudit(tx, tenantId, {
        action: 'admissions.familyRegistration.commit',
        entityType: 'FinancialAccount',
        entityId: financialAccount.id,
        metadata: {
          parentId,
          academicYearId: dto.academicYearId,
          studentCount: dto.students.length,
          installments,
          paymentMode: dto.paymentMode,
        },
      });

      return { financialAccount, plan: familyPlan, enrollmentIds };
    });
  }

  /** Reconstruct a family commit result from a prior idempotent commit (returns the same account). */
  private async loadFamilyResult(tx: TxClient, idempotencyKey: string) {
    const commitments = await tx.registrationCommitment.findMany({
      where: { idempotencyKey: { startsWith: `${idempotencyKey}:` } },
      orderBy: { idempotencyKey: 'asc' },
      select: { enrollmentId: true, studentId: true },
    });
    const enrollmentIds = commitments.map((c) => c.enrollmentId);
    const firstStudent = commitments[0]?.studentId;
    const account = firstStudent
      ? await tx.studentFinancialAccount.findFirst({
          where: { studentId: firstStudent },
          select: { payerId: true },
        })
      : null;
    const financialAccount = account?.payerId
      ? await tx.payer.findFirst({ where: { id: account.payerId } })
      : null;
    const plan = financialAccount
      ? await tx.financialAccountPlan.findFirst({
          where: { payerId: financialAccount.id },
          orderBy: { createdAt: 'desc' },
        })
      : null;
    return { financialAccount, plan, enrollmentIds };
  }

  // ── Add a student to an EXISTING family (the existing-family wizard) ──
  /**
   * Add another child to an existing FinancialAccount. Three modes, none of which ever modify paid
   * history:
   *   MERGE     — fold the new student into the existing active family plan, spreading their tuition
   *               over only the REMAINING (future) family installment dates; already-paid installments
   *               are untouched.
   *   SEPARATE  — bill the new student through the family account but on their own independent plan.
   *   NEW_PLAN  — start a brand-new family plan (requires confirm=true; affects accounting).
   */
  async addStudentToFamily(financialAccountId: string, dto: AddFamilyStudentDto) {
    return this.run(async (tx, tenantId) => {
      const key = `${dto.idempotencyKey}:add`;
      const prior = await tx.registrationCommitment.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: key } },
        select: { enrollmentId: true },
      });
      if (prior) return { enrollmentId: prior.enrollmentId, mode: dto.mode, reused: true };

      const fa = await tx.payer.findFirst({
        where: { id: financialAccountId },
        select: { id: true, parentId: true },
      });
      if (!fa) throw new BadRequestException('Financial account not found');
      if (!fa.parentId) {
        throw new BadRequestException('Financial account has no guardian to link the student to');
      }
      const parentId = fa.parentId;

      const quote = await tx.enrollmentQuote.findFirst({
        where: { id: dto.quoteId },
        include: { items: true },
      });
      if (!quote) throw new BadRequestException('Quote not found');
      if (quote.items.length === 0) throw new BadRequestException('Quote has no fee lines');

      // Resolve/create the student and link the family's guardian.
      let studentId = dto.existingStudentId ?? null;
      if (!studentId) {
        if (!dto.student) throw new BadRequestException('Student information is required');
        const s = dto.student;
        const studentNumber = await allocateStudentNumber(tx, tenantId);
        const created = await tx.student.create({
          data: {
            tenantId,
            studentNumber,
            firstNameEn: s.firstNameEn,
            lastNameEn: s.lastNameEn,
            firstNameAr: s.firstNameAr || s.firstNameEn,
            lastNameAr: s.lastNameAr || s.lastNameEn,
            ...(s.gender ? { gender: s.gender } : {}),
            ...(s.dateOfBirth ? { dateOfBirth: new Date(s.dateOfBirth) } : {}),
            ...(s.nationalId ? { nationalId: s.nationalId } : {}),
            // Identity only — placement is set on the Enrollment and cached by createEnrollmentRowTx.
            status: StudentStatus.ACTIVE,
            qrCode: generateStudentQrCode(),
          },
          select: { id: true },
        });
        studentId = created.id;
      }
      const existingLink = await tx.parentStudent.findFirst({
        where: { tenantId, parentId, studentId },
        select: { id: true },
      });
      if (!existingLink) {
        await tx.parentStudent.create({
          data: {
            tenantId,
            parentId,
            studentId,
            relation: ParentRelation.GUARDIAN,
            isPrimary: true,
          },
        });
      }

      // Decide the plan alignment from the mode.
      let override: FamilyPlanOverride | undefined;
      let planId: string | null = null;
      if (dto.mode === AddFamilyStudentMode.MERGE) {
        if (quote.paymentMode !== QuotePaymentMode.INSTALLMENTS) {
          throw new BadRequestException(
            'MERGE requires the new student to be quoted in installments',
          );
        }
        const plan = await tx.financialAccountPlan.findFirst({
          where: {
            payerId: financialAccountId,
            academicYearId: quote.academicYearId,
            status: 'ACTIVE',
          },
          orderBy: { createdAt: 'desc' },
        });
        if (!plan) {
          throw new BadRequestException(
            'No active account plan to merge into — use NEW_PLAN or SEPARATE instead',
          );
        }
        // Only the REMAINING (today-or-later) family installment dates get the new student's tuition;
        // earlier (already-billed/paid) dates are never touched.
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const remaining: Date[] = [];
        for (let i = 0; i < plan.installments; i += 1) {
          const due = addMonths(plan.firstDueDate, i);
          if (due >= startOfToday) remaining.push(due);
        }
        const firstRemaining = remaining[0] ?? new Date();
        override = {
          financialPlanId: plan.id,
          installments: remaining.length > 0 ? remaining.length : 1,
          firstDueDate: firstRemaining,
        };
        planId = plan.id;
      } else if (dto.mode === AddFamilyStudentMode.NEW_PLAN) {
        if (!dto.confirm) {
          throw new BadRequestException(
            'Creating a new family plan requires confirmation (confirm=true)',
          );
        }
        const paymentMode = dto.paymentMode ?? quote.paymentMode;
        const installments =
          paymentMode === QuotePaymentMode.FULL ? 1 : (dto.installments ?? quote.installments);
        const firstDue = dto.firstDueDate
          ? new Date(dto.firstDueDate)
          : (quote.firstDueDate ?? new Date());
        const plan = await tx.financialAccountPlan.create({
          data: {
            tenantId,
            payerId: financialAccountId,
            academicYearId: quote.academicYearId,
            cadence: 'MONTHLY',
            installments,
            firstDueDate: firstDue,
            createdById: this.actor(),
          },
        });
        override =
          paymentMode === QuotePaymentMode.INSTALLMENTS
            ? { financialPlanId: plan.id, installments, firstDueDate: firstDue }
            : undefined; // FULL new plan: per-line charges, still under the family account
        planId = plan.id;
      }
      // SEPARATE: no override — the student keeps their own plan (from their quote), still billed
      // through the family account so family payments can settle them.

      const enrollment = await this.createEnrollmentRowTx(tx, tenantId, {
        studentId,
        academicYearId: quote.academicYearId,
        gradeId: quote.gradeId,
        sectionId: dto.sectionId ?? null,
        quoteId: quote.id,
        transportDirection: quote.transportDirection,
        paymentMode: quote.paymentMode,
        feeModified: quote.feeModified,
        registrationFeePaid: dto.registrationFeePaid ?? true,
        admissionStatus: AdmissionStatus.REGISTERED,
      });

      const account = await this.accounts.ensureAccountTx(tx, tenantId, studentId);
      await this.financialAccounts.linkStudentAccountTx(tx, account.id, financialAccountId);
      await this.createEnrollmentCharges(
        tx,
        tenantId,
        studentId,
        enrollment.id,
        quote,
        dto.registrationFeePaid ?? true,
        override,
      );

      if (dto.busRouteId) {
        const route = await tx.busRoute.findFirst({
          where: { id: dto.busRouteId, deletedAt: null },
          select: { id: true },
        });
        if (!route) throw new BadRequestException('Bus route not found in this tenant');
        const existingAssignment = await tx.studentBusAssignment.findFirst({
          where: { studentId },
        });
        if (existingAssignment) {
          await tx.studentBusAssignment.update({
            where: { id: existingAssignment.id },
            data: { routeId: dto.busRouteId, stopId: null, tripRound: dto.busTripRound ?? null },
          });
        } else {
          await tx.studentBusAssignment.create({
            data: {
              tenantId,
              studentId,
              routeId: dto.busRouteId,
              tripRound: dto.busTripRound ?? null,
            },
          });
        }
      }

      await tx.registrationCommitment.create({
        data: {
          tenantId,
          enrollmentId: enrollment.id,
          studentId,
          idempotencyKey: key,
          committedById: this.actor(),
        },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'admissions.family.addStudent',
        entityType: 'Enrollment',
        entityId: enrollment.id,
        metadata: { financialAccountId, studentId, mode: dto.mode, planId },
      });

      return { enrollmentId: enrollment.id, mode: dto.mode, financialAccountId, planId };
    });
  }

  // ── Returning-student lookup ──
  async loadReturning(studentId: string) {
    return this.run(async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId, deletedAt: null },
        include: {
          parentLinks: { include: { parent: true } },
          enrollments: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { grade: true, academicYear: true },
          },
          billingProfile: true,
        },
      });
      if (!student) throw new BadRequestException('Student not found');
      return student;
    });
  }

  /**
   * Context for re-enrolling a returning student (Step 7): the student's existing Financial Account
   * (Payer), the target quote's academic year, and whether they are ALREADY enrolled for that year
   * (so re-enrollment never creates a duplicate — the DB unique on (student, year) is the backstop).
   */
  async reEnrollContext(studentId: string, quoteId: string) {
    return this.run(async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId, deletedAt: null },
        select: { id: true },
      });
      if (!student) throw new BadRequestException('Student not found');

      const quote = await tx.enrollmentQuote.findFirst({
        where: { id: quoteId },
        select: { academicYearId: true },
      });
      if (!quote) throw new BadRequestException('Quote not found');

      const account = await tx.studentFinancialAccount.findFirst({
        where: { studentId },
        select: { payerId: true },
      });
      const existing = await tx.enrollment.findFirst({
        where: { studentId, academicYearId: quote.academicYearId },
        select: { id: true },
      });
      return {
        financialAccountId: account?.payerId ?? null,
        academicYearId: quote.academicYearId,
        alreadyEnrolled: existing !== null,
      };
    });
  }

  /**
   * Enrollment statistics for reporting (Step 11), optionally scoped to one Academic Year. Returns the
   * two DISTINCT breakdowns (Decision 2): participation `byStatus` and admission-funnel
   * `byAdmissionStatus`. Closed years remain fully reportable (Decision 12).
   */
  async enrollmentStats(academicYearId?: string) {
    return this.run(async (tx) => {
      const where = academicYearId ? { academicYearId } : {};
      const [byStatus, byAdmission, total] = await Promise.all([
        tx.enrollment.groupBy({ by: ['status'], where, _count: { _all: true } }),
        tx.enrollment.groupBy({ by: ['admissionStatus'], where, _count: { _all: true } }),
        tx.enrollment.count({ where }),
      ]);
      return {
        total,
        byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
        byAdmissionStatus: Object.fromEntries(
          byAdmission.map((r) => [r.admissionStatus, r._count._all]),
        ),
      };
    });
  }

  // ── Enrollments / reporting ──
  listEnrollments(filter: {
    academicYearId?: string;
    gradeId?: string;
    status?: EnrollmentStatus;
    admissionStatus?: AdmissionStatus;
  }) {
    return this.run((tx) =>
      tx.enrollment.findMany({
        where: {
          ...(filter.academicYearId ? { academicYearId: filter.academicYearId } : {}),
          ...(filter.gradeId ? { gradeId: filter.gradeId } : {}),
          ...(filter.status ? { status: filter.status } : {}),
          ...(filter.admissionStatus ? { admissionStatus: filter.admissionStatus } : {}),
        },
        include: {
          student: { select: { id: true, firstNameEn: true, lastNameEn: true } },
          grade: { select: { nameEn: true } },
          academicYear: { select: { name: true } },
          commitment: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    );
  }

  listModifications(status?: ApprovalStatus) {
    return this.run((tx) =>
      tx.feeModification.findMany({
        where: status ? { approval: { status } } : {},
        include: {
          approval: true,
          enrollment: { include: { student: { select: { firstNameEn: true, lastNameEn: true } } } },
        },
        orderBy: { modifiedAt: 'desc' },
        take: 500,
      }),
    );
  }

  decideModification(modificationId: string, approve: boolean, note?: string) {
    return this.run(async (tx, tenantId) => {
      const approval = await tx.feeModificationApproval.findUnique({
        where: { modificationId },
        include: { modification: true },
      });
      if (!approval) throw new BadRequestException('No pending approval for this modification');

      // Separation of duties: by default the user who applied the fee modification cannot
      // approve/reject it. Schools with a single finance person can opt out via the
      // allowSelfFeeApproval billing-policy flag.
      const actor = this.actor();
      if (actor && approval.modification.modifiedById === actor) {
        const policy = await tx.billingPolicy.findUnique({ where: { tenantId } });
        if (!policy?.allowSelfFeeApproval) {
          throw new ForbiddenException(
            'You cannot approve a fee modification you created. A different user must decide it.',
          );
        }
      }

      const status = approve ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;
      const row = await tx.feeModificationApproval.update({
        where: { modificationId },
        data: {
          status,
          approverId: this.actor(),
          decidedAt: new Date(),
          ...(note ? { note } : {}),
        },
      });
      // Apply the decision to the held enrollment. Approval registers it (admissionStatus REGISTERED)
      // and creates the charges that were deferred at commit time; rejection cancels the admission
      // (no charges exist). Both are scoped to admissionStatus ACCEPTED so a decision on one of several
      // modifications for an already-decided enrollment is a safe no-op (charges never created twice).
      const enrollmentId = approval.modification.enrollmentId;
      if (enrollmentId) {
        const { count } = await tx.enrollment.updateMany({
          where: { id: enrollmentId, admissionStatus: AdmissionStatus.ACCEPTED },
          data: approve
            ? { admissionStatus: AdmissionStatus.REGISTERED, status: EnrollmentStatus.ACTIVE }
            : { admissionStatus: AdmissionStatus.CANCELLED },
        });
        if (approve && count > 0) {
          const enrollment = await tx.enrollment.findFirstOrThrow({
            where: { id: enrollmentId },
            include: { quote: { include: { items: true } } },
          });
          if (enrollment.quote) {
            // Align the now-created charges to the account plan (Payer's active plan for the year),
            // so an approved held student still lands on the shared account installment dates. Legacy
            // enrollments with no account plan fall back to the quote's own schedule.
            const studentAccount = await tx.studentFinancialAccount.findFirst({
              where: { studentId: enrollment.studentId },
              select: { payerId: true },
            });
            const accountPlan = studentAccount?.payerId
              ? await tx.financialAccountPlan.findFirst({
                  where: {
                    payerId: studentAccount.payerId,
                    academicYearId: enrollment.academicYearId,
                    status: 'ACTIVE',
                  },
                  orderBy: { createdAt: 'desc' },
                })
              : null;
            const override: FamilyPlanOverride | undefined = accountPlan
              ? {
                  financialPlanId: accountPlan.id,
                  installments: accountPlan.installments,
                  firstDueDate: accountPlan.firstDueDate,
                }
              : undefined;
            await this.createEnrollmentCharges(
              tx,
              tenantId,
              enrollment.studentId,
              enrollment.id,
              enrollment.quote,
              enrollment.registrationFeePaid,
              override,
            );
          }
        }
      }
      await this.writeAudit(tx, tenantId, {
        action: approve ? 'admissions.feeMod.approve' : 'admissions.feeMod.reject',
        entityType: 'FeeModificationApproval',
        entityId: row.id,
        metadata: { modificationId },
      });
      return row;
    });
  }

  /** The enrollment a fee modification belongs to (used to (re)generate its registration agreement). */
  enrollmentIdForModification(modificationId: string): Promise<string | null> {
    return this.run(async (tx) => {
      const mod = await tx.feeModification.findFirst({
        where: { id: modificationId },
        select: { enrollmentId: true },
      });
      return mod?.enrollmentId ?? null;
    });
  }

  createArrangement(dto: CreateArrangementDto) {
    return this.run(async (tx, tenantId) => {
      const row = await tx.financialArrangement.create({
        data: {
          tenantId,
          studentId: dto.studentId,
          ...(dto.enrollmentId ? { enrollmentId: dto.enrollmentId } : {}),
          description: dto.description,
          createdById: this.actor(),
        },
      });
      await tx.studentBillingProfile.upsert({
        where: { studentId: dto.studentId },
        create: { tenantId, studentId: dto.studentId, customArrangement: true },
        update: { customArrangement: true },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'admissions.arrangement.create',
        entityType: 'FinancialArrangement',
        entityId: row.id,
        metadata: { studentId: dto.studentId },
      });
      return row;
    });
  }
}
