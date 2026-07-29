import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentLanguage, DocumentType } from '@prisma/client';
import { StatementService, type StudentStatement } from '../finance/statement/statement.service';
import { DocumentRepository } from './document.repository';
import type { BuiltDocument, DocumentParams } from './document.types';
import type { DocumentLayout, FieldRow, LayoutBlock } from './pdf/document-layout';
import { L, amount, dateStr, docNumber, fullNameAr, fullNameEn, money } from './templates/util';

type StudentCtx = NonNullable<Awaited<ReturnType<DocumentRepository['studentContext']>>>;

/**
 * Finance Documents (Part 2 + Part 6). Each builder collects data from the existing billing ledger /
 * statement (never recomputing or duplicating financial records) and maps it to a declarative
 * {@link DocumentLayout} returned as a {@link BuiltDocument}. The Document Engine decides whether to
 * archive a PDF (none of these do — they are all DYNAMIC) or render on demand. Because the builders
 * are pure (params in → layout out), the same `build()` re-renders a document from the live ledger
 * every time it is downloaded/printed/emailed. Receipt generation is independent of Admissions.
 */
@Injectable()
export class FinanceDocumentsService {
  constructor(
    private readonly repo: DocumentRepository,
    private readonly statements: StatementService,
  ) {}

  /**
   * Dispatch on document type to the matching builder, re-collecting live data each call. Used both
   * for the initial generate and for every subsequent download/print/email of a DYNAMIC document.
   */
  build(params: DocumentParams): Promise<BuiltDocument> {
    const language = params.language;
    switch (params.type) {
      case DocumentType.PAYMENT_RECEIPT:
        if (!params.paymentId) throw new BadRequestException('paymentId is required for a receipt');
        return this.paymentReceipt(params.paymentId, language);
      case DocumentType.ANNUAL_TUITION_CERTIFICATE:
        if (!params.studentId || !params.year)
          throw new BadRequestException('studentId and year are required');
        return this.annualTuitionCertificate(params.studentId, params.year, language);
      case DocumentType.OUTSTANDING_BALANCE_CERTIFICATE:
        return this.outstandingBalanceCertificate(this.requireStudentId(params), language);
      case DocumentType.CLEARANCE_CERTIFICATE:
        return this.clearanceCertificate(this.requireStudentId(params), language);
      case DocumentType.ACCOUNT_STATEMENT:
        return this.accountStatement(this.requireStudentId(params), language);
      case DocumentType.PAYMENT_HISTORY:
        return this.paymentHistory(this.requireStudentId(params), language);
      case DocumentType.FEE_BREAKDOWN:
        return this.feeBreakdown(this.requireStudentId(params), language);
      case DocumentType.STUDENT_FINANCIAL_SUMMARY:
        return this.studentFinancialSummary(this.requireStudentId(params), language);
      default:
        throw new BadRequestException(`Type ${params.type} is not a dynamic finance document`);
    }
  }

  private requireStudentId(params: DocumentParams): string {
    if (!params.studentId) throw new BadRequestException('studentId is required');
    return params.studentId;
  }

  // ── Header field helpers ───────────────────────────────────────────────────
  private studentFields(ctx: StudentCtx, language: DocumentLanguage): FieldRow[] {
    const parent = ctx.parentLinks[0]?.parent ?? null;
    const grade = ctx.section?.grade;
    return [
      // Script-matched labels (no language suffix): the label's own script signals the name's language.
      { label: 'Student', value: fullNameEn(ctx) },
      { label: 'الطالب', value: fullNameAr(ctx) },
      { label: L(language, 'National ID', 'الرقم الوطني'), value: ctx.nationalId ?? '—' },
      {
        label: L(language, 'Grade / Section', 'الصف / الشعبة'),
        value: grade
          ? `${language === DocumentLanguage.AR ? grade.nameAr : grade.nameEn}${ctx.section?.name ? ` · ${ctx.section.name}` : ''}`
          : '—',
      },
      {
        label: L(language, 'Parent / Guardian', 'ولي الأمر'),
        value: parent ? fullNameEn(parent) : '—',
      },
      { label: L(language, 'Phone', 'الهاتف'), value: parent?.phone ?? '—' },
    ];
  }

  private async requireStudent(studentId: string): Promise<StudentCtx> {
    const ctx = await this.repo.studentContext(studentId);
    if (!ctx) throw new NotFoundException('Student not found');
    return ctx;
  }

  private metaNow(language: DocumentLanguage): FieldRow {
    return { label: L(language, 'Issue Date', 'تاريخ الإصدار'), value: dateStr(new Date()) };
  }

  // ── Payment Receipt ─────────────────────────────────────────────────────────
  async paymentReceipt(paymentId: string, language: DocumentLanguage): Promise<BuiltDocument> {
    const txn = await this.repo.paymentContext(paymentId);
    if (!txn) throw new NotFoundException('Transaction not found');
    if (txn.status !== 'VERIFIED') {
      throw new BadRequestException('A receipt can only be issued for a verified payment');
    }
    const cashier = await this.repo.userName(txn.recordedById);
    const parent = txn.student.parentLinks[0]?.parent ?? null;
    const allocations = txn.allocations.filter((a) => !a.reversedAt);
    const allocatedTotal = allocations.reduce((s, a) => s + Number(a.amount), 0);
    const summary = await this.statements.forStudent(txn.studentId);

    const snapshot = {
      receiptNo: txn.receiptNo,
      date: dateStr(txn.verifiedAt ?? txn.createdAt),
      cashier,
      method: txn.method,
      reference: txn.reference,
      student: fullNameEn(txn.student),
      parent: parent ? fullNameEn(parent) : null,
      amount: txn.amount.toFixed(3),
      allocated: allocatedTotal.toFixed(3),
      outstanding: summary.totals.outstanding,
      creditBalance: summary.totals.creditBalance,
      charges: allocations.map((a) => ({
        description: a.installment?.charge?.description ?? '—',
        amount: a.amount.toFixed(3),
      })),
    };

    const blocks: LayoutBlock[] = [
      {
        kind: 'fields',
        columns: 2,
        rows: [
          { label: L(language, 'Student', 'الطالب'), value: snapshot.student },
          { label: L(language, 'Parent', 'ولي الأمر'), value: snapshot.parent ?? '—' },
          { label: L(language, 'Payment Method', 'طريقة الدفع'), value: snapshot.method },
          { label: L(language, 'Reference', 'المرجع'), value: snapshot.reference ?? '—' },
          { label: L(language, 'Cashier', 'أمين الصندوق'), value: snapshot.cashier ?? '—' },
        ],
      },
    ];
    if (snapshot.charges.length > 0) {
      blocks.push({
        kind: 'table',
        columns: [
          { header: L(language, 'Charge Paid', 'البند المدفوع'), key: 'description', width: 3 },
          { header: L(language, 'Amount', 'المبلغ'), key: 'amount', align: 'right' },
        ],
        rows: snapshot.charges,
      });
    }
    blocks.push({
      kind: 'totals',
      rows: [
        { label: L(language, 'Amount Received', 'المبلغ المستلم'), value: money(snapshot.amount) },
        { label: L(language, 'Allocated', 'المخصص'), value: money(snapshot.allocated) },
        {
          label: L(language, 'Outstanding Balance', 'الرصيد المستحق'),
          value: money(snapshot.outstanding),
        },
        {
          label: L(language, 'Credit Balance', 'الرصيد الدائن'),
          value: money(snapshot.creditBalance),
        },
      ],
    });

    const layout: DocumentLayout = {
      title: L(language, 'Payment Receipt', 'إيصال دفع'),
      language,
      meta: [
        {
          label: L(language, 'Receipt No.', 'رقم الإيصال'),
          value: txn.receiptNo != null ? docNumber('RCPT', txn.receiptNo) : '—',
        },
        { label: L(language, 'Date', 'التاريخ'), value: snapshot.date },
      ],
      blocks,
    };

    return {
      type: DocumentType.PAYMENT_RECEIPT,
      language,
      layout,
      studentId: txn.studentId,
      parentId: parent?.id ?? null,
      paymentId,
      dataSnapshot: snapshot,
    };
  }

  // ── Annual Tuition Certificate (Part 6) ─────────────────────────────────────
  /**
   * Certifies the WHOLE amount the family actually paid to the school during a calendar year
   * (1 Jan … 31 Dec) as a single figure — never separated by fee category. This is the annual/tax
   * certificate, so the period is a calendar year (not the academic year) and the amount is every
   * verified payment received in that window.
   */
  async annualTuitionCertificate(
    studentId: string,
    year: number,
    language: DocumentLanguage,
  ): Promise<BuiltDocument> {
    const ctx = await this.requireStudent(studentId);
    const paid = await this.repo.paidInCalendarYear(studentId, year);

    const periodEn = `1 January ${year} – 31 December ${year}`;
    const periodAr = `1 يناير ${year} – 31 ديسمبر ${year}`;

    const snapshot = {
      year,
      period: L(language, periodEn, periodAr),
      student: fullNameEn(ctx),
      parent: ctx.parentLinks[0]?.parent ? fullNameEn(ctx.parentLinks[0].parent) : null,
      paid,
    };

    const layout: DocumentLayout = {
      title: L(language, 'Annual Tuition Certificate', 'شهادة الرسوم الدراسية السنوية'),
      subtitle: L(
        language,
        `Certifies the total amount paid to the school during the calendar year ${year}.`,
        `تشهد بإجمالي المبلغ المدفوع للمدرسة خلال السنة الميلادية ${year}.`,
      ),
      language,
      meta: [
        { label: L(language, 'Year', 'السنة'), value: String(year) },
        { label: L(language, 'Period', 'الفترة'), value: L(language, periodEn, periodAr) },
        this.metaNow(language),
      ],
      blocks: [
        { kind: 'fields', columns: 2, rows: this.studentFields(ctx, language) },
        {
          kind: 'paragraph',
          text: L(
            language,
            `This is to certify that the total amount paid to the school for the above-named student during the period ${periodEn} is ${money(paid)}.`,
            `نشهد بأن إجمالي المبلغ المدفوع للمدرسة عن الطالب المذكور أعلاه خلال الفترة ${periodAr} هو ${money(paid)}.`,
          ),
        },
        {
          kind: 'totals',
          rows: [{ label: L(language, 'Total Paid', 'إجمالي المدفوع'), value: money(paid) }],
        },
        {
          kind: 'signatures',
          blocks: [
            { label: L(language, 'Finance Manager', 'المدير المالي') },
            { label: L(language, 'Official Signature & Stamp', 'التوقيع والختم الرسمي') },
          ],
        },
      ],
    };

    return {
      type: DocumentType.ANNUAL_TUITION_CERTIFICATE,
      language,
      layout,
      studentId,
      parentId: ctx.parentLinks[0]?.parent?.id ?? null,
      dataSnapshot: snapshot,
    };
  }

  // ── Outstanding Balance Certificate ─────────────────────────────────────────
  async outstandingBalanceCertificate(
    studentId: string,
    language: DocumentLanguage,
  ): Promise<BuiltDocument> {
    const ctx = await this.requireStudent(studentId);
    const st = await this.statements.forStudent(studentId);
    const snapshot = this.summaryNumbers(st);
    const layout: DocumentLayout = {
      title: L(language, 'Outstanding Balance Certificate', 'شهادة الرصيد المستحق'),
      language,
      meta: [this.metaNow(language)],
      blocks: [
        { kind: 'fields', columns: 2, rows: this.studentFields(ctx, language) },
        {
          kind: 'paragraph',
          text: L(
            language,
            `This is to certify that, as of ${dateStr(new Date())}, the outstanding balance on the above student's account is ${money(snapshot.outstanding)}.`,
            `نشهد بأنه حتى تاريخ ${dateStr(new Date())} يبلغ الرصيد المستحق على حساب الطالب المذكور ${money(snapshot.outstanding)}.`,
          ),
        },
        {
          kind: 'totals',
          rows: [
            {
              label: L(language, 'Total Charged', 'إجمالي المستحق'),
              value: money(snapshot.charged),
            },
            { label: L(language, 'Total Paid', 'إجمالي المدفوع'), value: money(snapshot.paid) },
            {
              label: L(language, 'Outstanding Balance', 'الرصيد المستحق'),
              value: money(snapshot.outstanding),
            },
          ],
        },
        {
          kind: 'signatures',
          blocks: [{ label: L(language, 'Finance Manager', 'المدير المالي') }],
        },
      ],
    };
    return this.toBuilt(layout, DocumentType.OUTSTANDING_BALANCE_CERTIFICATE, ctx, snapshot);
  }

  // ── Clearance Certificate ───────────────────────────────────────────────────
  async clearanceCertificate(
    studentId: string,
    language: DocumentLanguage,
  ): Promise<BuiltDocument> {
    const ctx = await this.requireStudent(studentId);
    const st = await this.statements.forStudent(studentId);
    const snapshot = this.summaryNumbers(st);
    const cleared = Number(snapshot.outstanding) <= 0;
    if (!cleared) {
      throw new BadRequestException(
        `Cannot issue a clearance certificate: the account has an outstanding balance of ${money(snapshot.outstanding)}`,
      );
    }
    const layout: DocumentLayout = {
      title: L(language, 'Financial Clearance Certificate', 'شهادة براءة ذمة مالية'),
      language,
      meta: [this.metaNow(language)],
      blocks: [
        { kind: 'fields', columns: 2, rows: this.studentFields(ctx, language) },
        {
          kind: 'paragraph',
          text: L(
            language,
            `This is to certify that the above-named student has no outstanding financial obligations to the school as of ${dateStr(new Date())}.`,
            `نشهد بأن الطالب المذكور أعلاه ليس عليه أي التزامات مالية تجاه المدرسة حتى تاريخ ${dateStr(new Date())}.`,
          ),
        },
        {
          kind: 'signatures',
          blocks: [{ label: L(language, 'Finance Manager', 'المدير المالي') }],
        },
      ],
    };
    return this.toBuilt(layout, DocumentType.CLEARANCE_CERTIFICATE, ctx, snapshot);
  }

  // ── Account Statement (running ledger) ──────────────────────────────────────
  async accountStatement(studentId: string, language: DocumentLanguage): Promise<BuiltDocument> {
    const ctx = await this.requireStudent(studentId);
    const st = await this.statements.forStudent(studentId);
    const entries = this.ledgerEntries(st);
    const snapshot = { ...this.summaryNumbers(st), entries };
    const layout: DocumentLayout = {
      title: L(language, 'Statement of Account', 'كشف حساب'),
      language,
      meta: [this.metaNow(language)],
      blocks: [
        { kind: 'fields', columns: 2, rows: this.studentFields(ctx, language) },
        {
          kind: 'table',
          columns: [
            { header: L(language, 'Date', 'التاريخ'), key: 'date' },
            { header: L(language, 'Description', 'البيان'), key: 'description', width: 3 },
            { header: L(language, 'Debit', 'مدين'), key: 'debit', align: 'right' },
            { header: L(language, 'Credit', 'دائن'), key: 'credit', align: 'right' },
            { header: L(language, 'Balance', 'الرصيد'), key: 'balance', align: 'right' },
          ],
          rows: entries.map((e) => ({
            date: e.date ?? '—',
            description: e.description,
            debit: e.debit ? amount(e.debit) : '',
            credit: e.credit ? amount(e.credit) : '',
            balance: amount(e.running),
          })),
        },
        {
          kind: 'totals',
          rows: [
            {
              label: L(language, 'Total Charged', 'إجمالي المستحق'),
              value: money(snapshot.charged),
            },
            { label: L(language, 'Total Paid', 'إجمالي المدفوع'), value: money(snapshot.paid) },
            { label: L(language, 'Outstanding', 'المستحق'), value: money(snapshot.outstanding) },
          ],
        },
      ],
    };
    return this.toBuilt(layout, DocumentType.ACCOUNT_STATEMENT, ctx, snapshot);
  }

  // ── Payment History ─────────────────────────────────────────────────────────
  async paymentHistory(studentId: string, language: DocumentLanguage): Promise<BuiltDocument> {
    const ctx = await this.requireStudent(studentId);
    const st = await this.statements.forStudent(studentId);
    const verified = st.payments.filter((t) => t.status === 'VERIFIED');
    const total = verified.reduce((s, t) => s + Number(t.amount), 0);
    const snapshot = {
      payments: verified.map((t) => ({
        receiptNo: t.receiptNo != null ? docNumber('RCPT', t.receiptNo) : '—',
        date: dateStr(t.verifiedAt ?? t.createdAt),
        method: t.method,
        amount: t.amount.toFixed(3),
        cashier: t.recordedByName ?? '—',
      })),
      total: total.toFixed(3),
    };
    const layout: DocumentLayout = {
      title: L(language, 'Payment History', 'سجل المدفوعات'),
      language,
      meta: [this.metaNow(language)],
      blocks: [
        { kind: 'fields', columns: 2, rows: this.studentFields(ctx, language) },
        {
          kind: 'table',
          columns: [
            { header: L(language, 'Receipt No.', 'رقم الإيصال'), key: 'receiptNo' },
            { header: L(language, 'Date', 'التاريخ'), key: 'date' },
            { header: L(language, 'Method', 'الطريقة'), key: 'method' },
            { header: L(language, 'Cashier', 'أمين الصندوق'), key: 'cashier' },
            { header: L(language, 'Amount', 'المبلغ'), key: 'amount', align: 'right' },
          ],
          rows: snapshot.payments,
          totalsRow: {
            receiptNo: L(language, 'Total', 'الإجمالي'),
            date: '',
            method: '',
            cashier: '',
            amount: amount(snapshot.total),
          },
        },
      ],
    };
    return this.toBuilt(layout, DocumentType.PAYMENT_HISTORY, ctx, snapshot);
  }

  // ── Fee Breakdown ─────────────────────────────────────────────────────────
  async feeBreakdown(studentId: string, language: DocumentLanguage): Promise<BuiltDocument> {
    const ctx = await this.requireStudent(studentId);
    const st = await this.statements.forStudent(studentId);
    const snapshot = {
      lines: st.charges.map((b) => ({
        description: b.charge.description,
        gross: b.gross,
        discount: b.discount,
        net: b.net,
        paid: b.paid,
        balance: b.balance,
      })),
      ...this.summaryNumbers(st),
    };
    const layout: DocumentLayout = {
      title: L(language, 'Fee Breakdown', 'تفصيل الرسوم'),
      language,
      meta: [this.metaNow(language)],
      blocks: [
        { kind: 'fields', columns: 2, rows: this.studentFields(ctx, language) },
        {
          kind: 'table',
          columns: [
            { header: L(language, 'Charge', 'البند'), key: 'description', width: 3 },
            { header: L(language, 'Amount', 'المبلغ'), key: 'gross', align: 'right' },
            { header: L(language, 'Discount', 'الخصم'), key: 'discount', align: 'right' },
            { header: L(language, 'Paid', 'المدفوع'), key: 'paid', align: 'right' },
            { header: L(language, 'Balance', 'الرصيد'), key: 'balance', align: 'right' },
          ],
          rows: snapshot.lines.map((l) => ({
            description: l.description,
            gross: amount(l.gross),
            discount: amount(l.discount),
            paid: amount(l.paid),
            balance: amount(l.balance),
          })),
          totalsRow: {
            description: L(language, 'Total', 'الإجمالي'),
            gross: amount(snapshot.charged),
            discount: amount(snapshot.discounts),
            paid: amount(snapshot.paid),
            balance: amount(snapshot.outstanding),
          },
        },
      ],
    };
    return this.toBuilt(layout, DocumentType.FEE_BREAKDOWN, ctx, snapshot);
  }

  // ── Student Financial Summary ───────────────────────────────────────────────
  async studentFinancialSummary(
    studentId: string,
    language: DocumentLanguage,
  ): Promise<BuiltDocument> {
    const ctx = await this.requireStudent(studentId);
    const st = await this.statements.forStudent(studentId);
    const snapshot = this.summaryNumbers(st);
    const layout: DocumentLayout = {
      title: L(language, 'Student Financial Summary', 'الملخص المالي للطالب'),
      language,
      meta: [this.metaNow(language)],
      blocks: [
        { kind: 'fields', columns: 2, rows: this.studentFields(ctx, language) },
        {
          kind: 'totals',
          rows: [
            {
              label: L(language, 'Total Charged', 'إجمالي المستحق'),
              value: money(snapshot.charged),
            },
            { label: L(language, 'Discounts', 'الخصومات'), value: money(snapshot.discounts) },
            { label: L(language, 'Credits', 'الأرصدة الدائنة'), value: money(snapshot.credits) },
            { label: L(language, 'Total Paid', 'إجمالي المدفوع'), value: money(snapshot.paid) },
            { label: L(language, 'Refunded', 'المسترد'), value: money(snapshot.refunded) },
            {
              label: L(language, 'Credit Balance', 'الرصيد الدائن'),
              value: money(snapshot.creditBalance),
            },
            {
              label: L(language, 'Outstanding Balance', 'الرصيد المستحق'),
              value: money(snapshot.outstanding),
            },
          ],
        },
      ],
    };
    return this.toBuilt(layout, DocumentType.STUDENT_FINANCIAL_SUMMARY, ctx, snapshot);
  }

  // ── shared helpers ──────────────────────────────────────────────────────────
  private summaryNumbers(st: StudentStatement) {
    return {
      charged: st.totals.charged,
      paid: st.totals.paid,
      outstanding: st.totals.outstanding,
      discounts: st.totals.discounts,
      credits: st.totals.creditBalance,
      refunded: st.totals.refunded,
      creditBalance: st.totals.creditBalance,
    };
  }

  private ledgerEntries(st: StudentStatement) {
    type Entry = {
      date: string | null;
      description: string;
      debit: number;
      credit: number;
      running: number;
    };
    const entries: Omit<Entry, 'running'>[] = [];
    for (const b of st.charges) {
      entries.push({
        date: b.charge.dueDate ? dateStr(b.charge.dueDate) : null,
        description: b.charge.description,
        debit: Number(b.net),
        credit: 0,
      });
    }
    for (const tx of st.payments) {
      if (tx.status !== 'VERIFIED') continue;
      entries.push({
        date: dateStr(tx.verifiedAt ?? tx.createdAt),
        description: `Payment · ${tx.method}${tx.receiptNo != null ? ` · ${docNumber('RCPT', tx.receiptNo)}` : ''}`,
        debit: 0,
        credit: Number(tx.amount),
      });
    }
    for (const a of st.adjustments) {
      if (a.status !== 'APPLIED') continue;
      entries.push({
        date: dateStr(a.createdAt),
        description: `${a.type.replace(/_/g, ' ')}${a.reason ? ` · ${a.reason}` : ''}`,
        debit: 0,
        credit: Number(a.amount),
      });
    }
    for (const r of st.refunds) {
      if (r.status !== 'VERIFIED') continue;
      entries.push({
        date: dateStr(r.createdAt),
        description: `Refund${r.reason ? ` · ${r.reason}` : ''}`,
        debit: Number(r.amount),
        credit: 0,
      });
    }
    entries.sort((x, y) => {
      if (x.date && y.date) return x.date < y.date ? -1 : x.date > y.date ? 1 : 0;
      if (x.date) return -1;
      if (y.date) return 1;
      return 0;
    });
    let running = 0;
    return entries.map((e) => {
      running += e.debit - e.credit;
      return { ...e, running };
    });
  }

  private toBuilt(
    layout: DocumentLayout,
    type: DocumentType,
    ctx: StudentCtx,
    snapshot: unknown,
  ): BuiltDocument {
    return {
      type,
      language: layout.language ?? DocumentLanguage.EN,
      layout,
      studentId: ctx.id,
      parentId: ctx.parentLinks[0]?.parent?.id ?? null,
      dataSnapshot: snapshot as BuiltDocument['dataSnapshot'],
    };
  }
}
