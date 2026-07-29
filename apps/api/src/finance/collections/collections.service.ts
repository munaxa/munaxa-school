import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  type ReminderChannel,
  type ReminderLevel,
  type StudentBillingProfile,
} from '@prisma/client';
import { LedgerRepository } from '../ledger/ledger.repository';
import { CollectionsRepository } from './collections.repository';
import { SmsService } from './sms.service';
import { MailService } from '../../mail/mail.service';
import type { Env } from '../../config/env.validation';
import { NotificationEventBus } from '../../communication/engine/notification-event-bus';
import { NotificationEventType } from '../../communication/engine/notification-events';
import { agedAmount, qualifiesOutstanding } from './outstanding-filter';
import type {
  LogCommunicationDto,
  PushOutstandingDto,
  RecordPromiseDto,
  SendReminderDto,
  SetCollectionsDto,
} from './collections.dto';
import type { DunningEvent, PromiseToPay } from '@prisma/client';

const ZERO = new Prisma.Decimal(0);

/** A promise-to-pay with a derived workflow status for the UI. */
export interface PromiseView {
  id: string;
  amount: string;
  promiseBy: Date;
  note: string | null;
  createdById: string | null;
  createdAt: Date;
  /** OPEN (awaiting the date), KEPT, BROKEN, or OVERDUE (past date, not yet resolved). */
  status: 'OPEN' | 'KEPT' | 'BROKEN' | 'OVERDUE';
}

function toPromiseView(p: PromiseToPay): PromiseView {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  let status: PromiseView['status'];
  if (p.kept === true) status = 'KEPT';
  else if (p.kept === false) status = 'BROKEN';
  else status = new Date(p.promiseBy) < startOfDay ? 'OVERDUE' : 'OPEN';
  return {
    id: p.id,
    amount: p.amount.toFixed(3),
    promiseBy: p.promiseBy,
    note: p.note,
    createdById: p.createdById,
    createdAt: p.createdAt,
    status,
  };
}

export interface DashboardPromise {
  id: string;
  studentId: string;
  studentName: string;
  amount: string;
  promiseBy: Date;
}

export interface FinanceDashboard {
  promisesDueToday: DashboardPromise[];
  promisesMissed: DashboardPromise[];
  transportSuspensions: Array<{ studentId: string; studentName: string; suspendedAt: Date | null }>;
  topOutstanding: Array<{
    studentId: string;
    studentName: string;
    outstanding: string;
    overdue: string;
  }>;
  workload: {
    studentsWithOutstanding: number;
    overdueStudents: number;
    openCases: number;
    promisesOpen: number;
    transportSuspended: number;
  };
  totalOutstanding: string;
  collectedPct: string;
}

export interface ReminderSnapshot {
  outstanding: string;
  dueThisMonth: string;
  overdue: string;
  overdueCount: number; // number of overdue installments/charges with a remaining balance
  oldestOverdueDays: number; // age in days of the earliest overdue charge (0 if none)
  delinquencyLevel: number; // 0 current, 1 ≤30d, 2 31–60d, 3 61–90d, 4 >90d (from oldest overdue)
  eligible: boolean; // has something due this month or overdue
}

export interface AgingBuckets {
  studentId: string;
  studentName?: string; // resolved display name (populated in the aging report)
  current: string; // balance not yet overdue (incl. undated charges)
  d1_30: string;
  d31_60: string;
  d61_90: string;
  d90plus: string;
  total: string; // total outstanding balance
}

export interface AgingReport {
  rows: AgingBuckets[];
  totals: Omit<AgingBuckets, 'studentId'>;
  /** Collection effectiveness: share of total charged that has been settled (0–100, 2 dp). */
  collectedPct: string;
}

export interface TransportEvaluation {
  studentId: string;
  overdueCount: number;
  threshold: number;
  suspended: boolean; // resulting state
  changed: boolean; // whether this evaluation flipped the state
}

/** Delinquency level from the oldest overdue charge's age. */
function levelFor(oldestOverdueDays: number): number {
  if (oldestOverdueDays <= 0) return 0;
  if (oldestOverdueDays <= 30) return 1;
  if (oldestOverdueDays <= 60) return 2;
  if (oldestOverdueDays <= 90) return 3;
  return 4;
}

export interface SendResult {
  studentId: string;
  recipients: number;
  smsSent: number;
  emailsSent: number;
  snapshot: ReminderSnapshot;
}

export interface BatchResult {
  candidates: number;
  sent: number;
  skippedLegal: number;
  skippedNotDue: number;
  totalRecipients: number;
  totalSms: number;
}

export interface PushOutstandingResult {
  filter: { minAgeDays: number | null; minAmount: string | null; match: 'ALL' | 'ANY' };
  candidates: number; // accounts with unpaid charges considered
  matched: number; // accounts that passed the filter
  pushed: number; // accounts an outstanding-balance push was emitted for
  skippedLegal: number; // excluded (LEGAL collections tag)
  skippedNoParent: number; // matched but no parent account to notify
  totalRecipients: number; // total parent notifications created
  totalEmails: number; // settlement emails sent to parents' email addresses
}

/**
 * Fee collections: per-student legal/collections tagging and late-payment reminders.
 * Reminders bundle "this month's payment" and "late (overdue) payments", and are sent to the
 * student's parents via in-app notification and/or SMS. Students tagged LEGAL
 * ("contact the lawyer") are excluded from reminders.
 */
@Injectable()
export class CollectionsService {
  constructor(
    private readonly repo: CollectionsRepository,
    private readonly ledger: LedgerRepository,
    private readonly sms: SmsService,
    private readonly notifications: NotificationEventBus,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ----------------------------------------------------------------- tagging

  async getProfile(studentId: string): Promise<{
    studentId: string;
    collectionsStatus: StudentBillingProfile['collectionsStatus'];
    legalNote: string | null;
    flaggedAt: Date | null;
    lastReminderAt: Date | null;
    transportSuspended: boolean;
    transportSuspendedAt: Date | null;
    transportSuspendedReason: string | null;
    transportSuspendedById: string | null;
    transportReinstatedAt: Date | null;
    feeModified: boolean;
    customArrangement: boolean;
    snapshot: ReminderSnapshot;
    reminders: Awaited<ReturnType<CollectionsRepository['listReminders']>>;
    promises: PromiseView[];
    communications: DunningEvent[];
  }> {
    if (!(await this.repo.studentExists(studentId))) {
      throw new NotFoundException('Student not found in this tenant');
    }
    const [profile, snapshot, reminders, promises, communications] = await Promise.all([
      this.repo.getProfile(studentId),
      this.snapshot(studentId),
      this.repo.listReminders(studentId),
      this.repo.listPromises(studentId),
      this.repo.listCommunications(studentId),
    ]);
    return {
      studentId,
      collectionsStatus: profile?.collectionsStatus ?? 'NONE',
      legalNote: profile?.legalNote ?? null,
      flaggedAt: profile?.flaggedAt ?? null,
      lastReminderAt: profile?.lastReminderAt ?? null,
      transportSuspended: profile?.transportSuspended ?? false,
      transportSuspendedAt: profile?.transportSuspendedAt ?? null,
      transportSuspendedReason: profile?.transportSuspendedReason ?? null,
      transportSuspendedById: profile?.transportSuspendedById ?? null,
      transportReinstatedAt: profile?.transportReinstatedAt ?? null,
      // Permanent financial flags (set by admissions registrar overrides / arrangements).
      feeModified: profile?.feeModified ?? false,
      customArrangement: profile?.customArrangement ?? false,
      snapshot,
      reminders,
      promises: promises.map(toPromiseView),
      communications,
    };
  }

  // ─────────────────────────────────────────────── Promise to Pay / Communication Log

  /** Record a promise-to-pay (parent commits amount by date). Opens a case if needed. */
  async recordPromise(studentId: string, dto: RecordPromiseDto): Promise<PromiseView> {
    if (!(await this.repo.studentExists(studentId))) {
      throw new NotFoundException('Student not found in this tenant');
    }
    const promise = await this.repo.createPromise({
      studentId,
      amount: new Prisma.Decimal(dto.amount),
      promiseBy: new Date(dto.promiseBy),
      note: dto.note ?? null,
    });
    if (!promise) throw new BadRequestException('Student has no financial account yet');
    return toPromiseView(promise);
  }

  listPromises(studentId: string): Promise<PromiseView[]> {
    return this.repo.listPromises(studentId).then((ps) => ps.map(toPromiseView));
  }

  async resolvePromise(promiseId: string, kept: boolean): Promise<PromiseView> {
    return toPromiseView(await this.repo.resolvePromise(promiseId, kept));
  }

  /** Log a parent contact (call/WhatsApp/meeting/…) into the Communication Log. */
  async logCommunication(studentId: string, dto: LogCommunicationDto): Promise<DunningEvent> {
    if (!(await this.repo.studentExists(studentId))) {
      throw new NotFoundException('Student not found in this tenant');
    }
    const event = await this.repo.logCommunication({
      studentId,
      medium: dto.medium,
      note: dto.note,
    });
    if (!event) throw new BadRequestException('Student has no financial account yet');
    return event;
  }

  listCommunications(studentId: string): Promise<DunningEvent[]> {
    return this.repo.listCommunications(studentId);
  }

  async setCollections(studentId: string, dto: SetCollectionsDto): Promise<StudentBillingProfile> {
    if (!(await this.repo.studentExists(studentId))) {
      throw new NotFoundException('Student not found in this tenant');
    }
    return this.repo.setCollectionsStatus(studentId, dto.status, dto.note ?? null);
  }

  // --------------------------------------------------------------- reminders

  /** Compute this-month-due / overdue / outstanding from the OPEN INSTALLMENTS + due dates (§12). */
  async snapshot(studentId: string): Promise<ReminderSnapshot> {
    const [installments, summary] = await Promise.all([
      this.ledger.openInstallments(studentId),
      this.ledger.accountSummary(studentId),
    ]);
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    let overdue = ZERO;
    let dueThisMonth = ZERO;
    let overdueCount = 0;
    let oldestOverdue: Date | null = null;
    for (const inst of installments) {
      const balance = inst.balance;
      if (balance.lessThanOrEqualTo(ZERO) || !inst.dueDate) continue;
      const due = new Date(inst.dueDate);
      if (due < startOfDay) {
        overdue = overdue.plus(balance);
        overdueCount += 1;
        if (!oldestOverdue || due < oldestOverdue) oldestOverdue = due;
      } else if (due >= startOfMonth && due <= endOfMonth) {
        dueThisMonth = dueThisMonth.plus(balance);
      }
    }
    const oldestOverdueDays = oldestOverdue
      ? Math.floor((startOfDay.getTime() - oldestOverdue.getTime()) / 86_400_000)
      : 0;
    return {
      outstanding: summary.outstanding,
      dueThisMonth: dueThisMonth.toFixed(3),
      overdue: overdue.toFixed(3),
      overdueCount,
      oldestOverdueDays,
      delinquencyLevel: levelFor(oldestOverdueDays),
      eligible: overdue.greaterThan(ZERO) || dueThisMonth.greaterThan(ZERO),
    };
  }

  // --------------------------------------------------------- aging / reports

  /** Bucket a student's outstanding balance by the age of each open installment's due date (§12). */
  async aging(studentId: string): Promise<AgingBuckets> {
    const installments = await this.ledger.openInstallments(studentId);
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let current = ZERO;
    let d1_30 = ZERO;
    let d31_60 = ZERO;
    let d61_90 = ZERO;
    let d90plus = ZERO;
    for (const inst of installments) {
      const bal = inst.balance;
      if (bal.lessThanOrEqualTo(ZERO)) continue;
      const due = inst.dueDate ? new Date(inst.dueDate) : null;
      if (!due || due >= startOfDay) {
        current = current.plus(bal);
        continue;
      }
      const days = Math.floor((startOfDay.getTime() - due.getTime()) / 86_400_000);
      if (days <= 30) d1_30 = d1_30.plus(bal);
      else if (days <= 60) d31_60 = d31_60.plus(bal);
      else if (days <= 90) d61_90 = d61_90.plus(bal);
      else d90plus = d90plus.plus(bal);
    }
    const total = current.plus(d1_30).plus(d31_60).plus(d61_90).plus(d90plus);
    return {
      studentId,
      current: current.toFixed(3),
      d1_30: d1_30.toFixed(3),
      d31_60: d31_60.toFixed(3),
      d61_90: d61_90.toFixed(3),
      d90plus: d90plus.toFixed(3),
      total: total.toFixed(3),
    };
  }

  /** Aging report across all accounts with an outstanding balance, plus collection effectiveness. */
  async agingReport(): Promise<AgingReport> {
    const candidates = await this.repo.studentsWithUnpaidCharges();
    const rows: AgingBuckets[] = [];
    const sum = {
      current: ZERO,
      d1_30: ZERO,
      d31_60: ZERO,
      d61_90: ZERO,
      d90plus: ZERO,
      total: ZERO,
    };
    for (const studentId of candidates) {
      const a = await this.aging(studentId);
      if (new Prisma.Decimal(a.total).lessThanOrEqualTo(ZERO)) continue;
      const names = await this.repo.studentNames(studentId);
      if (names) a.studentName = names.en;
      rows.push(a);
      sum.current = sum.current.plus(a.current);
      sum.d1_30 = sum.d1_30.plus(a.d1_30);
      sum.d31_60 = sum.d31_60.plus(a.d31_60);
      sum.d61_90 = sum.d61_90.plus(a.d61_90);
      sum.d90plus = sum.d90plus.plus(a.d90plus);
      sum.total = sum.total.plus(a.total);
    }
    const { charged, paid } = await this.repo.tenantChargedAndPaid();
    const collectedPct = charged.greaterThan(ZERO)
      ? paid.times(100).dividedBy(charged).toFixed(2)
      : '0.00';
    return {
      rows,
      totals: {
        current: sum.current.toFixed(3),
        d1_30: sum.d1_30.toFixed(3),
        d31_60: sum.d31_60.toFixed(3),
        d61_90: sum.d61_90.toFixed(3),
        d90plus: sum.d90plus.toFixed(3),
        total: sum.total.toFixed(3),
      },
      collectedPct,
    };
  }

  /**
   * Operational finance dashboard: the collection workload a finance officer opens their day with —
   * promises due today, recently missed promises, transport suspensions, the largest outstanding
   * balances, and headline workload counts. Derived from the ledger + collections feeds.
   */
  async dashboard(): Promise<FinanceDashboard> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [feeds, aging] = await Promise.all([this.repo.dashboardFeeds(), this.agingReport()]);

    const promisesDueToday: DashboardPromise[] = [];
    const promisesMissed: DashboardPromise[] = [];
    let promisesOpen = 0;
    for (const p of feeds.promises) {
      const by = new Date(p.promiseBy);
      const row: DashboardPromise = {
        id: p.id,
        studentId: p.studentId,
        studentName: p.studentName,
        amount: p.amount.toFixed(3),
        promiseBy: p.promiseBy,
      };
      if (p.kept === null) {
        promisesOpen += 1;
        if (by < startOfDay)
          promisesMissed.push(row); // open + past due date = missed
        else if (by.getTime() === startOfDay.getTime()) promisesDueToday.push(row);
      } else if (p.kept === false) {
        promisesMissed.push(row); // explicitly marked broken
      }
    }

    // Largest outstanding balances (top 10) + overdue workload from the aging report.
    const topOutstanding = aging.rows
      .slice()
      .sort((a, b) => Number(b.total) - Number(a.total))
      .slice(0, 10)
      .map((r) => ({
        studentId: r.studentId,
        studentName: r.studentName ?? '—',
        outstanding: r.total,
        overdue: (
          Number(r.d1_30) +
          Number(r.d31_60) +
          Number(r.d61_90) +
          Number(r.d90plus)
        ).toFixed(3),
      }));
    const overdueStudents = aging.rows.filter(
      (r) => Number(r.d1_30) + Number(r.d31_60) + Number(r.d61_90) + Number(r.d90plus) > 0,
    ).length;

    return {
      promisesDueToday,
      promisesMissed: promisesMissed.slice(0, 20),
      transportSuspensions: feeds.suspensions.map((s) => ({
        studentId: s.studentId,
        studentName: s.studentName,
        suspendedAt: s.suspendedAt,
      })),
      topOutstanding,
      workload: {
        studentsWithOutstanding: aging.rows.length,
        overdueStudents,
        openCases: feeds.openCaseCount,
        promisesOpen,
        transportSuspended: feeds.suspensions.length,
      },
      totalOutstanding: aging.totals.total,
      collectedPct: aging.collectedPct,
    };
  }

  // ---------------------------------------------------- transport suspension

  /**
   * Evaluate a student's transport service against the tenant billing policy: suspend when the
   * number of overdue installments reaches BillingPolicy.suspendTransportAfterOverdue, and
   * auto-restore once they fall back below it. Idempotent — only writes (and audits) on a flip.
   */
  async evaluateTransport(studentId: string): Promise<TransportEvaluation> {
    if (!(await this.repo.studentExists(studentId))) {
      throw new NotFoundException('Student not found in this tenant');
    }
    const [snapshot, policy, profile] = await Promise.all([
      this.snapshot(studentId),
      this.repo.transportPolicy(),
      this.repo.getProfile(studentId),
    ]);
    const overdueAmount = new Prisma.Decimal(snapshot.overdue);
    // Any satisfied threshold suspends: overdue installments, overdue age (days), or overdue amount.
    const reasons: string[] = [];
    if (snapshot.overdueCount >= policy.installments) {
      reasons.push(`${snapshot.overdueCount} overdue installment(s) ≥ ${policy.installments}`);
    }
    if (policy.days != null && snapshot.oldestOverdueDays >= policy.days) {
      reasons.push(`overdue ${snapshot.oldestOverdueDays}d ≥ ${policy.days}d`);
    }
    if (policy.amount != null && overdueAmount.greaterThanOrEqualTo(policy.amount)) {
      reasons.push(`overdue ${overdueAmount.toFixed(3)} ≥ ${policy.amount.toFixed(3)} JOD`);
    }
    const shouldSuspend = reasons.length > 0;
    const wasSuspended = profile?.transportSuspended ?? false;
    let suspended = wasSuspended;
    let changed = false;
    if (shouldSuspend && !wasSuspended) {
      await this.repo.setTransportSuspended(studentId, true, {
        reason: `Auto: ${reasons.join('; ')}`,
      });
      suspended = true;
      changed = true;
    } else if (!shouldSuspend && wasSuspended) {
      await this.repo.setTransportSuspended(studentId, false);
      suspended = false;
      changed = true;
    }
    return {
      studentId,
      overdueCount: snapshot.overdueCount,
      threshold: policy.installments,
      suspended,
      changed,
    };
  }

  /** Manually suspend a student's transport for non-payment (records the reason + who). */
  async suspendTransport(studentId: string, reason: string): Promise<StudentBillingProfile> {
    if (!(await this.repo.studentExists(studentId))) {
      throw new NotFoundException('Student not found in this tenant');
    }
    return this.repo.setTransportSuspended(studentId, true, { reason, manual: true });
  }

  /** Manually reinstate a student's transport. */
  async reinstateTransport(studentId: string): Promise<StudentBillingProfile> {
    if (!(await this.repo.studentExists(studentId))) {
      throw new NotFoundException('Student not found in this tenant');
    }
    return this.repo.setTransportSuspended(studentId, false, { manual: true });
  }

  /** Sweep every student with unpaid charges and reconcile their transport-suspension state. */
  async evaluateTransportBatch(): Promise<{
    evaluated: number;
    suspended: number;
    restored: number;
  }> {
    // Union of students with unpaid charges and those currently suspended (so paid-off accounts
    // are restored even though they no longer have an unpaid charge).
    const [unpaid, suspendedIds] = await Promise.all([
      this.repo.studentsWithUnpaidCharges(),
      this.repo.suspendedStudentIds(),
    ]);
    const candidates = [...new Set([...unpaid, ...suspendedIds])];
    let suspended = 0;
    let restored = 0;
    for (const studentId of candidates) {
      const r = await this.evaluateTransport(studentId);
      if (r.changed && r.suspended) suspended += 1;
      if (r.changed && !r.suspended) restored += 1;
    }
    return { evaluated: candidates.length, suspended, restored };
  }

  /** Send a reminder to one student's parents. Blocked for LEGAL-tagged accounts. */
  async sendForStudent(studentId: string, dto: SendReminderDto): Promise<SendResult> {
    if (!(await this.repo.studentExists(studentId))) {
      throw new NotFoundException('Student not found in this tenant');
    }
    const profile = await this.repo.getProfile(studentId);
    if (profile?.collectionsStatus === 'LEGAL') {
      throw new ConflictException(
        'Student is in legal collections (contact the lawyer) — automated reminders are excluded',
      );
    }
    const snapshot = await this.snapshot(studentId);
    if (!snapshot.eligible) {
      throw new BadRequestException('Nothing due this month or overdue for this student');
    }
    return this.dispatch(studentId, dto.channels, snapshot, dto.level ?? null);
  }

  /** Bulk reminders to every student with dues this month / overdue, excluding LEGAL-tagged. */
  async sendBatch(dto: SendReminderDto): Promise<BatchResult> {
    const candidates = await this.repo.studentsWithUnpaidCharges();
    const profiles = await this.repo.profilesFor(candidates);
    const legal = new Set(
      profiles.filter((p) => p.collectionsStatus === 'LEGAL').map((p) => p.studentId),
    );

    const result: BatchResult = {
      candidates: candidates.length,
      sent: 0,
      skippedLegal: 0,
      skippedNotDue: 0,
      totalRecipients: 0,
      totalSms: 0,
    };

    for (const studentId of candidates) {
      if (legal.has(studentId)) {
        result.skippedLegal += 1;
        continue;
      }
      const snapshot = await this.snapshot(studentId);
      if (!snapshot.eligible) {
        result.skippedNotDue += 1;
        continue;
      }
      const sent = await this.dispatch(studentId, dto.channels, snapshot, dto.level ?? null);
      result.sent += 1;
      result.totalRecipients += sent.recipients;
      result.totalSms += sent.smsSent;
    }
    return result;
  }

  // --------------------------------------------------- push outstanding balance

  /**
   * Admin-triggered: push each qualifying student's outstanding balance to their parents via the
   * notification engine (FCM push, with the platform's email escalation for HIGH-priority finance
   * alerts). Narrowed by aging (>30/60/90 days) and/or a minimum amount. LEGAL-tagged students are
   * excluded. Routes through the engine — no direct sends.
   */
  async pushOutstanding(dto: PushOutstandingDto): Promise<PushOutstandingResult> {
    const candidates = await this.repo.studentsWithUnpaidCharges();
    const profiles = await this.repo.profilesFor(candidates);
    const legal = new Set(
      profiles.filter((p) => p.collectionsStatus === 'LEGAL').map((p) => p.studentId),
    );

    const result: PushOutstandingResult = {
      filter: {
        minAgeDays: dto.minAgeDays ?? null,
        minAmount: dto.minAmount ?? null,
        match: dto.match ?? 'ALL',
      },
      candidates: candidates.length,
      matched: 0,
      pushed: 0,
      skippedLegal: 0,
      skippedNoParent: 0,
      totalRecipients: 0,
      totalEmails: 0,
    };
    const alsoEmail = dto.email !== false;

    for (const studentId of candidates) {
      if (legal.has(studentId)) {
        result.skippedLegal += 1;
        continue;
      }
      const a = await this.aging(studentId);
      if (!qualifiesOutstanding(a, dto)) continue;
      result.matched += 1;

      const [names, parents] = await Promise.all([
        this.repo.studentNames(studentId),
        this.repo.parentsOf(studentId),
      ]);
      const userIds = parents.map((p) => p.userId).filter((id): id is string => Boolean(id));
      const emails = alsoEmail
        ? [...new Set(parents.map((p) => p.email).filter((e): e is string => Boolean(e)))]
        : [];
      // Nothing to reach the family by — neither an in-app/push account nor an email on file.
      if (userIds.length === 0 && emails.length === 0) {
        result.skippedNoParent += 1;
        continue;
      }

      const overdue = agedAmount(a, dto.minAgeDays);
      const { title, body } = this.buildOutstandingMessage(
        names ?? { en: 'your child', ar: 'ابنكم' },
        a.total,
        overdue,
        dto.minAgeDays,
      );

      let pushRecipients = 0;
      if (userIds.length > 0) {
        const summary = await this.notifications.emit({
          type: NotificationEventType.PaymentOverdue,
          recipients: { userIds },
          title,
          body,
          context: { StudentName: names?.en ?? 'your child', Amount: `${a.total} JOD` },
          data: { studentId, outstanding: a.total, overdue: overdue.toFixed(3) },
          mandatory: dto.mandatory ?? false,
        });
        pushRecipients = summary.recipients;
      }

      // Email the assigned parent(s) directly (reaches guardians without a login account).
      let emailsSent = 0;
      if (emails.length > 0) {
        const from = this.config.get('EMAIL_FROM_FINANCE', { infer: true });
        const html = body
          .split('\n')
          .map((line) => `<p>${line}</p>`)
          .join('');
        for (const to of emails) {
          const { sent } = await this.mail.send({ to, from, subject: title, html, text: body });
          if (sent) emailsSent += 1;
        }
      }

      const channels: ReminderChannel[] = [
        ...(pushRecipients > 0 ? (['PUSH'] as const) : []),
        ...(emailsSent > 0 ? (['EMAIL'] as const) : []),
      ];
      await this.repo.logReminder({
        studentId,
        channels: channels.length ? channels : ['PUSH'],
        outstanding: new Prisma.Decimal(a.total),
        dueThisMonth: ZERO,
        overdue,
        recipientCount: pushRecipients,
        smsSentCount: 0,
      });

      result.pushed += 1;
      result.totalRecipients += pushRecipients;
      result.totalEmails += emailsSent;
    }

    return result;
  }

  /**
   * Concise bilingual outstanding-balance notice. When an age filter is in effect AND the account
   * actually has a positive amount aged beyond it, the notice leads with that overdue amount (what
   * the admin filtered for); otherwise it states the total outstanding. It never claims a "0 JOD
   * overdue" amount.
   */
  private buildOutstandingMessage(
    names: { en: string; ar: string },
    total: string,
    overdue: Prisma.Decimal,
    minAgeDays?: 30 | 60 | 90,
  ): { title: string; body: string } {
    const showOverdue = minAgeDays != null && overdue.greaterThan(0);
    const en = showOverdue
      ? `${names.en}: ${overdue.toFixed(3)} JOD overdue by more than ${minAgeDays} days ` +
        `(of ${total} JOD total outstanding). Please settle the overdue amount at your earliest convenience.`
      : `Outstanding balance for ${names.en}: ${total} JOD. Please settle at your earliest convenience.`;
    const ar = showOverdue
      ? `${names.ar}: ${overdue.toFixed(3)} دينار متأخرة أكثر من ${minAgeDays} يومًا ` +
        `(من إجمالي ${total} دينار مستحقة). نرجو سداد المبلغ المتأخر في أقرب وقت.`
      : `رصيد مستحق للطالب ${names.ar}: ${total} دينار. نرجو المبادرة بالسداد.`;
    return { title: 'Outstanding balance | رصيد مستحق', body: `${en}\n${ar}` };
  }

  // ------------------------------------------------------------------ helpers

  private async dispatch(
    studentId: string,
    channels: ReminderChannel[],
    snapshot: ReminderSnapshot,
    level: ReminderLevel | null = null,
  ): Promise<SendResult> {
    const [names, parents] = await Promise.all([
      this.repo.studentNames(studentId),
      this.repo.parentsOf(studentId),
    ]);
    const { title, body } = this.buildMessage(
      names ?? { en: 'your child', ar: 'ابنكم' },
      snapshot,
      level,
    );

    let recipients = 0;
    let smsSent = 0;
    let emailsSent = 0;

    if (channels.includes('IN_APP')) {
      const userIds = parents.map((p) => p.userId).filter((id): id is string => Boolean(id));
      recipients = await this.repo.createNotifications(userIds, { title, body });
    }
    if (channels.includes('SMS')) {
      const messages = parents
        .filter((p) => p.phone)
        .map((p) => ({ to: p.phone!, body: `${title} — ${body}` }));
      smsSent = await this.sms.send(messages);
    }
    // Email the parents on file (reaches guardians without a Munaxa app account — the common case).
    if (channels.includes('EMAIL')) {
      const emails = [
        ...new Set(parents.map((p) => p.email).filter((e): e is string => Boolean(e))),
      ];
      if (emails.length > 0) {
        const from = this.config.get('EMAIL_FROM_FINANCE', { infer: true });
        const html = body
          .split('\n')
          .map((line) => `<p>${line}</p>`)
          .join('');
        for (const to of emails) {
          const { sent } = await this.mail.send({ to, from, subject: title, html, text: body });
          if (sent) emailsSent += 1;
        }
      }
    }

    await this.repo.logReminder({
      studentId,
      channels,
      outstanding: new Prisma.Decimal(snapshot.outstanding),
      dueThisMonth: new Prisma.Decimal(snapshot.dueThisMonth),
      overdue: new Prisma.Decimal(snapshot.overdue),
      recipientCount: recipients,
      smsSentCount: smsSent,
      level,
    });

    return { studentId, recipients, smsSent, emailsSent, snapshot };
  }

  /** A short bilingual prefix that sets the reminder's tone by escalation level. */
  private levelPrefix(level: ReminderLevel | null): string {
    switch (level) {
      case 'FRIENDLY':
        return 'Friendly reminder | تذكير ودّي\n';
      case 'OVERDUE':
        return 'Overdue notice | إشعار تأخّر\n';
      case 'FINAL':
        return 'Final reminder | تذكير أخير\n';
      case 'TRANSPORT_WARNING':
        return 'Transport suspension warning | تحذير إيقاف النقل\n';
      case 'SUSPENSION_NOTICE':
        return 'Service suspension notice | إشعار إيقاف الخدمة\n';
      default:
        return '';
    }
  }

  /** Bilingual reminder bundling this month's due + overdue, prefixed by the escalation level. */
  private buildMessage(
    names: { en: string; ar: string },
    s: ReminderSnapshot,
    level: ReminderLevel | null = null,
  ): { title: string; body: string } {
    const en =
      `Payment reminder for ${names.en}: ${s.outstanding} JOD outstanding` +
      (Number(s.dueThisMonth) > 0 ? `, ${s.dueThisMonth} JOD due this month` : '') +
      (Number(s.overdue) > 0 ? `, ${s.overdue} JOD overdue` : '') +
      '. Please settle at your earliest convenience.';
    const ar =
      `تذكير بالدفع للطالب ${names.ar}: المبلغ المستحق ${s.outstanding} دينار` +
      (Number(s.dueThisMonth) > 0 ? `، منها ${s.dueThisMonth} دينار مستحقة هذا الشهر` : '') +
      (Number(s.overdue) > 0 ? `، و${s.overdue} دينار متأخرة` : '') +
      '. نرجو المبادرة بالسداد.';
    const prefix = this.levelPrefix(level);
    return { title: 'Payment reminder | تذكير بالدفع', body: `${prefix}${en}\n${ar}` };
  }
}
