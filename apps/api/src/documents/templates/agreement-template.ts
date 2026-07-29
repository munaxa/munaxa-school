import { DocumentLanguage } from '@prisma/client';
import type { DocumentLayout, LayoutBlock } from '../pdf/document-layout';
import { L, amount, dateStr, docNumber, money } from './util';

/** One student the parent is guardian of, with that student's own fee breakdown. */
export interface AgreementStudent {
  nameEn: string;
  nameAr: string;
  studentNumber: string;
  gradeName: string;
  sectionName?: string | null;
  /** Fee lines (fils-precision strings from the ledger; discount is a positive figure). */
  tuition: string;
  transportation: string;
  discount: string;
  /** Net payable for this student (tuition + transport − discount). */
  net: string;
}

/** One scheduled payment. `paid` / `notes` are blank at signing — the printed contract tracks them by hand. */
export interface AgreementInstallment {
  index: number;
  dueDate: string | null;
  amount: string;
  paid?: string | null;
  notes?: string | null;
}

/**
 * The permanent snapshot a Registration Agreement is rendered from. The registration agreement IS the
 * parent's financial commitment: the PARENT / guardian is the primary party and the agreement covers
 * ALL students under their guardianship for the academic year, each with its own fee line. Stored
 * verbatim (never recomputed) so a signed copy always reprints byte-identically — it is a legal record.
 */
export interface AgreementSnapshot {
  agreementNo: number;
  version: number;
  academicYearName: string;
  registrationDate: string;
  /** Parent / guardian identity (primary party). */
  parentNameEn: string;
  parentNameAr?: string | null;
  parentNationalId?: string | null;
  parentPhone?: string | null;
  parentAddress?: string | null;
  /** Every student the parent is guardian of for this year, each with their fees. */
  students: AgreementStudent[];
  /** Combined net total across all students. */
  grandTotal: string;
  /** Combined installment / payment schedule for the family. */
  schedule: AgreementInstallment[];
  /**
   * Tenant-configurable legal undertaking, as parallel English/Arabic clause arrays embedded verbatim
   * (Part 7 school settings), rendered as a mirrored two-column numbered declaration.
   */
  legalClausesEn: string[];
  legalClausesAr: string[];
  registrarName?: string | null;
}

/** Sum a set of fils-precision decimal strings and format to 3 decimals. */
function sum(values: string[]): string {
  return values.reduce((a, v) => a + Number(v), 0).toFixed(3);
}

/**
 * The master enterprise-document template. Every section is a reusable {@link LayoutBlock}, so the
 * agreement shares the exact same header/footer, information blocks, table, legal-clause and signature
 * components — and therefore the same spacing, typography, colours and branding — as every other
 * Munaxa document. Rendered at `compact` density so the whole agreement fits a single A4 page.
 */
export function buildAgreementLayout(
  s: AgreementSnapshot,
  language: DocumentLanguage,
): DocumentLayout {
  const blocks: LayoutBlock[] = [
    // ---- Parent / guardian (primary party) ----------------------------------------------------
    { kind: 'heading', text: L(language, 'Parent / Guardian', 'ولي الأمر') },
    {
      kind: 'fields',
      columns: 3,
      rows: [
        { label: 'Guardian', value: s.parentNameEn },
        { label: 'ولي الأمر', value: s.parentNameAr ?? s.parentNameEn },
        { label: L(language, 'National ID', 'الرقم الوطني'), value: s.parentNationalId ?? '—' },
        { label: L(language, 'Phone', 'الهاتف'), value: s.parentPhone ?? '—' },
        { label: L(language, 'Address', 'العنوان'), value: s.parentAddress ?? '—' },
        { label: L(language, 'Academic Year', 'العام الدراسي'), value: s.academicYearName },
      ],
    },

    // ---- Students under guardianship & their fees ---------------------------------------------
    { kind: 'heading', text: L(language, 'Students & Fees', 'الطلبة والرسوم') },
    {
      kind: 'table',
      columns: [
        { header: L(language, 'Student', 'اسم الطالب'), key: 'student', width: 2.6 },
        { header: L(language, 'Grade', 'الصف'), key: 'grade', width: 1.3 },
        { header: L(language, 'Tuition', 'قسط التعليم'), key: 'tuition', align: 'right' },
        { header: L(language, 'Transport', 'رسم النقل'), key: 'transportation', align: 'right' },
        { header: L(language, 'Discount', 'الحسومات'), key: 'discount', align: 'right' },
        { header: L(language, 'Net', 'القسط بعد الخصم'), key: 'net', align: 'right', width: 1.3 },
      ],
      rows: s.students.map((st) => ({
        student: language === DocumentLanguage.AR ? st.nameAr : st.nameEn,
        grade: st.sectionName ? `${st.gradeName} / ${st.sectionName}` : st.gradeName,
        tuition: amount(st.tuition),
        transportation: amount(st.transportation),
        discount: `-${amount(st.discount)}`,
        net: amount(st.net),
      })),
      totalsRow: {
        student: L(language, 'Grand Total', 'المجموع'),
        grade: '',
        tuition: amount(sum(s.students.map((x) => x.tuition))),
        transportation: amount(sum(s.students.map((x) => x.transportation))),
        discount: `-${amount(sum(s.students.map((x) => x.discount)))}`,
        net: amount(s.grandTotal),
      },
    },
  ];

  // ---- Combined installment / payment schedule ----------------------------------------------
  if (s.schedule.length > 0) {
    blocks.push(
      { kind: 'heading', text: L(language, 'Payment Schedule', 'طريقة الدفع') },
      {
        kind: 'table',
        // The schedule can list a registration line plus several monthly installments — render it
        // dense so a long schedule stays compact and does not push the agreement onto a second page.
        dense: true,
        columns: [
          { header: L(language, 'No.', 'رقم الدفعة'), key: 'index', width: 0.7 },
          { header: L(language, 'Due Date', 'تاريخ الدفعة'), key: 'dueDate', width: 1.4 },
          { header: L(language, 'Amount', 'قيمة الدفعة'), key: 'amount', align: 'right' },
          { header: L(language, 'Paid', 'قيمة السداد'), key: 'paid', align: 'right' },
          { header: L(language, 'Notes', 'ملاحظات'), key: 'notes', width: 1.6 },
        ],
        rows: s.schedule.map((i) => ({
          index: i.index,
          dueDate: i.dueDate ?? '—',
          amount: amount(i.amount),
          paid: i.paid ? amount(i.paid) : '',
          notes: i.notes ?? '',
        })),
        totalsRow: {
          index: '',
          dueDate: L(language, 'Total', 'المجموع'),
          amount: amount(sum(s.schedule.map((i) => i.amount))),
          paid: '',
          notes: '',
        },
      },
    );
  }

  // ---- Legal undertaking (embedded verbatim, mirrored two-column) -----------------------------
  blocks.push(
    { kind: 'heading', text: L(language, 'Acknowledgement & Undertaking', 'الإقرار والتعهد') },
    {
      kind: 'legal',
      en: language === DocumentLanguage.AR ? [] : s.legalClausesEn,
      ar: language === DocumentLanguage.EN ? [] : s.legalClausesAr,
    },
    {
      kind: 'signatures',
      blocks: [
        {
          label: L(language, 'Parent / Guardian Signature', 'توقيع ولي الأمر'),
          name: s.parentNameAr ?? s.parentNameEn,
        },
        {
          label: L(language, 'School Representative', 'ممثل المدرسة'),
          ...(s.registrarName ? { name: s.registrarName } : {}),
        },
        { label: L(language, 'Official Stamp', 'الختم الرسمي') },
      ],
    },
  );

  return {
    title: L(language, 'Registration Agreement', 'عقد تسجيل طالب'),
    subtitle: L(
      language,
      'A binding financial commitment between the school and the parent/guardian.',
      'التزام مالي ملزم بين المدرسة وولي الأمر.',
    ),
    language,
    density: 'compact',
    meta: [
      {
        label: L(language, 'Agreement No.', 'رقم الاتفاقية'),
        value: docNumber('AGR', s.agreementNo),
      },
      { label: L(language, 'Total Due', 'المستحق'), value: money(s.grandTotal) },
      { label: L(language, 'Date', 'التاريخ'), value: dateStr(s.registrationDate) },
    ],
    blocks,
  };
}

/**
 * The default binding undertaking clauses, embedded VERBATIM. The Arabic is the authoritative legal
 * text (final — never reworded, reordered, or re-punctuated); the English is its parallel translation
 * for the bilingual two-column declaration. A tenant may override both in Organization settings, but
 * the Arabic must always be stored and rendered exactly as provided.
 */
export const DEFAULT_AGREEMENT_LEGAL_CLAUSES_AR: string[] = [
  'أتعهد، بصفتي الشخصية، بدفع الأقساط الدراسية والرسوم المبينة أعلاه في المواعيد المحددة. وفي حال تخلفي عن سداد أي قسط أو رسم عند استحقاقه، يحق للمدرسة المطالبة بجميع المبالغ المستحقة واتخاذ الإجراءات القانونية اللازمة وفقاً لأحكام القوانين النافذة في المملكة الأردنية الهاشمية، مع استحقاق الفائدة القانونية بالحدود التي يجيزها القانون.',
  'وأقر بأن الأقساط الدراسية تشمل خدمة التعليم المعتمدة من وزارة التربية والتعليم، سواء كانت داخل المدرسة أو من خلال التعليم عن بُعد. كما أتعهد بعدم المطالبة باسترداد أي مبالغ دفعتها كأقساط أو رسوم أو بدلات، إلا وفقاً لشروط التسجيل المعتمدة لدى المدرسة وأحكام القوانين النافذة، بما في ذلك في حال انسحاب أي من أبنائي من المدرسة خلال السنة الدراسية.',
  'كما ألتزم بنظام النقل والمواصلات الساري في المدرسة طوال مدة الاشتراك بالخدمة، ويحق للمدرسة حجب الخدمات الاختيارية، ومنها خدمة النقل والمواصلات، عند التأخر في سداد المستحقات وفقاً لأنظمتها النافذة.',
  'وأتعهد برد قيمة خصم التفوق المشروط الذي منحته المدرسة لابني/ابنتي في المرحلة الثانوية إذا انسحب أو انتقل أو انفصل قبل إتمام المرحلة الثانوية، وذلك وفقاً لشروط الخصم المعتمدة.',
  'وأقر بأنني أفقد حق الاستفادة من أي خصومات أو مزايا منحتها المدرسة في حال عدم الالتزام بسداد أي دفعة في موعد استحقاقها، أو في حال إعادة أي شيك أو كمبيالة محررة لصالح المدرسة دون صرف، أو في حال انتقال أي من أبنائي أو الخاضعين لسلطتي القانونية من المدرسة خلال السنة الدراسية، وذلك وفقاً لشروط الخصومات وأحكام القانون.',
  'ويخضع هذا التعهد لأحكام القوانين النافذة في المملكة الأردنية الهاشمية، وتختص المحاكم الأردنية بالنظر في أي نزاع ينشأ عنه.',
];
export const DEFAULT_AGREEMENT_LEGAL_CLAUSES_EN: string[] = [
  'I, the undersigned, personally undertake to pay the tuition fees and charges stated above on the due dates. If I fail to pay any installment or fee when due, the school has the right to claim all outstanding amounts and take the necessary legal actions in accordance with the provisions of the applicable laws in the Hashemite Kingdom of Jordan, with entitlement to legal interest within the limits permitted by law.',
  'I acknowledge that tuition fees include the education service accredited by the Ministry of Education, whether provided on-campus or via distance learning. I also undertake not to request a refund of any amounts paid as installments, fees, or other charges, except in accordance with the school’s registration terms and the applicable laws, including in the event of withdrawal of any of my children from the school during the academic year.',
  'I commit to the school’s transportation system throughout the subscription period, and the school has the right to withhold optional services, including transportation, in case of delay in paying due amounts in accordance with its policies.',
  'I undertake to repay the value of the conditional academic excellence discount granted by the school to my son/daughter in the secondary stage if he/she withdraws, transfers, or leaves before completing the secondary stage, in accordance with the approved discount terms.',
  'I acknowledge that I lose the right to benefit from any discounts or privileges granted by the school in case of failure to pay any installment on its due date, or in case any cheque or promissory note issued in favor of the school is returned unpaid, or in case any of my children or those under my legal authority transfers from the school during the academic year, in accordance with the discount terms and the provisions of the law.',
  'I understand that this undertaking is governed by the applicable laws in the Hashemite Kingdom of Jordan, and the Jordanian courts have jurisdiction over any dispute arising herefrom.',
];

/** @deprecated Superseded by the mirrored {@link DEFAULT_AGREEMENT_LEGAL_CLAUSES_AR}/`_EN` clauses. */
export const DEFAULT_AGREEMENT_LEGAL_TEXT = DEFAULT_AGREEMENT_LEGAL_CLAUSES_EN.join('\n\n');
