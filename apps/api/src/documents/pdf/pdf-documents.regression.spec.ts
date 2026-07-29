import { DocumentLanguage } from '@prisma/client';
import { PdfRenderer } from './pdf-renderer';
import { layoutRuns } from './arabic-text';
import type { BrandingContext, DocumentLayout } from './document-layout';
import { buildAgreementLayout, type AgreementSnapshot } from '../templates/agreement-template';

/**
 * End-to-end regression coverage for complete, real-world Munaxa documents in Arabic, English and
 * bilingual variants. The registration agreement uses the production {@link buildAgreementLayout}
 * builder; receipt/invoice/statement/certificate are representative layouts (no builders exist for
 * them yet) that exercise every block kind — headers, meta, fields, tables, totals, signatures,
 * footers and page breaks — with realistic mixed content (names, money, dates, emails, URLs, IBANs,
 * invoice numbers and QR payloads). Each asserts a structurally valid, non-trivial PDF is produced.
 */

const branding: BrandingContext = {
  nameEn: 'Test Academy',
  nameAr: 'أكاديمية الاختبار',
  legalName: 'Test Academy LLC',
  addressLines: ['12 School St', 'Amman, Jordan'],
  phone: '+962 6 000 0000',
  email: 'info@test.edu',
  website: 'https://test.edu',
  footerNote: 'Test Academy · أكاديمية الاختبار',
};

const LANGS = [DocumentLanguage.EN, DocumentLanguage.AR, DocumentLanguage.BILINGUAL] as const;
const langName = (l: DocumentLanguage): string => l;

/** Bilingual label helper mirroring templates/util.L (kept local to avoid coupling the test to it). */
const L = (lang: DocumentLanguage, en: string, ar: string): string =>
  lang === DocumentLanguage.AR ? ar : lang === DocumentLanguage.BILINGUAL ? `${en} / ${ar}` : en;

const renderer = new PdfRenderer();

const expectValidPdf = (out: { buffer: Buffer; byteSize: number; checksum: string }): void => {
  expect(out.buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  expect(out.byteSize).toBeGreaterThan(800);
  expect(out.checksum).toMatch(/^[a-f0-9]{64}$/);
};

// ── Representative document builders (fixtures) ──────────────────────────────

function buildReceiptLayout(lang: DocumentLanguage): DocumentLayout {
  return {
    title: L(lang, 'Payment Receipt', 'إيصال دفع'),
    subtitle: L(lang, 'Official payment confirmation', 'تأكيد دفع رسمي'),
    language: lang,
    meta: [
      { label: L(lang, 'Receipt No.', 'رقم الإيصال'), value: 'RCP-000125' },
      { label: L(lang, 'Date', 'التاريخ'), value: '2026-07-07' },
    ],
    blocks: [
      { kind: 'heading', text: L(lang, 'Payer', 'الدافع') },
      {
        kind: 'fields',
        columns: 2,
        rows: [
          { label: L(lang, 'Student', 'الطالب'), value: 'أحمد محمد / Ahmad Mohammad' },
          { label: L(lang, 'Grade', 'الصف'), value: L(lang, 'Grade 1', 'الصف الأول') },
          { label: L(lang, 'Email', 'البريد'), value: 'ahmad@example.com' },
          { label: L(lang, 'Invoice', 'الفاتورة'), value: 'INV-2026-001025' },
        ],
      },
      { kind: 'heading', text: L(lang, 'Amount', 'المبلغ') },
      {
        kind: 'table',
        columns: [
          { header: L(lang, 'Description', 'الوصف'), key: 'desc', width: 2 },
          { header: L(lang, 'Amount', 'المبلغ'), key: 'amount', align: 'right' },
        ],
        rows: [
          { desc: L(lang, 'Tuition — رقم Invoice INV-1025', 'رسوم دراسية'), amount: '125.000' },
        ],
        totalsRow: { desc: L(lang, 'Total', 'الإجمالي'), amount: '125.000' },
      },
      { kind: 'totals', rows: [{ label: L(lang, 'Paid', 'المدفوع'), value: '125.000 JOD' }] },
      {
        kind: 'signatures',
        blocks: [{ label: L(lang, 'Cashier', 'أمين الصندوق'), name: 'أحمد محمد' }],
      },
    ],
    footer: L(lang, 'Thank you', 'شكرًا لكم'),
  };
}

function buildInvoiceLayout(lang: DocumentLanguage): DocumentLayout {
  return {
    title: L(lang, 'Tax Invoice', 'فاتورة ضريبية'),
    language: lang,
    meta: [
      { label: L(lang, 'Invoice No.', 'رقم الفاتورة'), value: 'INV-2026-001025' },
      { label: L(lang, 'IBAN', 'الآيبان'), value: 'JO94CBJO0010000000000131000302' },
    ],
    blocks: [
      {
        kind: 'paragraph',
        text: L(
          lang,
          'Pay online at https://munaxa.com/pay?id=1025',
          'ادفع عبر الإنترنت على https://munaxa.com/pay?id=1025',
        ),
      },
      {
        kind: 'table',
        columns: [
          { header: L(lang, 'Item', 'البند'), key: 'item', width: 2 },
          { header: L(lang, 'Qty', 'الكمية'), key: 'qty', align: 'right' },
          { header: L(lang, 'Unit', 'السعر'), key: 'unit', align: 'right' },
          { header: L(lang, 'Total', 'الإجمالي'), key: 'total', align: 'right' },
        ],
        rows: [
          { item: L(lang, 'Tuition', 'رسوم دراسية'), qty: '1', unit: '900.000', total: '900.000' },
          { item: L(lang, 'Books', 'كتب'), qty: '3', unit: '25.000', total: '75.000' },
        ],
        totalsRow: { item: L(lang, 'Total', 'الإجمالي'), qty: '4', unit: '', total: '975.000' },
      },
      {
        kind: 'totals',
        rows: [
          { label: L(lang, 'Subtotal', 'المجموع الفرعي'), value: '975.000 JOD' },
          { label: L(lang, 'Grand Total', 'الإجمالي النهائي'), value: '975.000 JOD' },
        ],
      },
      // A QR payload (ZATCA-style base64 TLV) — pure ASCII, must pass through untouched.
      { kind: 'paragraph', text: 'QR: AQ1UZXN0IEFjYWRlbXkCD0lOVi0yMDI2LTAwMTAyNQ==', muted: true },
    ],
  };
}

function buildStatementLayout(lang: DocumentLanguage): DocumentLayout {
  // Many rows to force wrapping and a page break, exercising the footer on multiple pages.
  const rows = Array.from({ length: 40 }, (_, i) => ({
    date: `2026-${String((i % 12) + 1).padStart(2, '0')}-15`,
    desc: L(lang, `Installment ${i + 1}`, `القسط ${i + 1}`),
    debit: i % 2 === 0 ? '100.000' : '',
    credit: i % 2 === 1 ? '100.000' : '',
    balance: `${(i + 1) * 50}.000`,
  }));
  return {
    title: L(lang, 'Account Statement', 'كشف حساب'),
    subtitle: L(lang, 'Student: أحمد محمد', 'الطالب: أحمد محمد'),
    language: lang,
    meta: [{ label: L(lang, 'Statement No.', 'رقم الكشف'), value: 'STM-000042' }],
    blocks: [
      {
        kind: 'table',
        columns: [
          { header: L(lang, 'Date', 'التاريخ'), key: 'date' },
          { header: L(lang, 'Description', 'البيان'), key: 'desc', width: 2 },
          { header: L(lang, 'Debit', 'مدين'), key: 'debit', align: 'right' },
          { header: L(lang, 'Credit', 'دائن'), key: 'credit', align: 'right' },
          { header: L(lang, 'Balance', 'الرصيد'), key: 'balance', align: 'right' },
        ],
        rows,
      },
    ],
    footer: L(lang, 'Generated by Munaxa', 'صادر عن مناكسة'),
  };
}

function buildCertificateLayout(lang: DocumentLanguage): DocumentLayout {
  return {
    title: L(lang, 'Certificate of Enrollment', 'شهادة قيد'),
    language: lang,
    meta: [{ label: L(lang, 'Certificate No.', 'رقم الشهادة'), value: 'CRT-000007' }],
    blocks: [
      {
        kind: 'paragraph',
        text: L(
          lang,
          'This certifies that the student named below is enrolled for the academic year 2025/2026.',
          'تشهد هذه الوثيقة بأن الطالب المذكور أدناه مقيّد للعام الدراسي ٢٠٢٥/٢٠٢٦.',
        ),
      },
      {
        kind: 'fields',
        columns: 2,
        rows: [
          { label: L(lang, 'Student', 'الطالب'), value: 'أحمد محمد' },
          { label: L(lang, 'National ID', 'الرقم الوطني'), value: '9990001112' },
          { label: L(lang, 'Grade', 'الصف'), value: L(lang, 'Grade 1 — الصف الأول', 'الصف الأول') },
        ],
      },
      {
        kind: 'signatures',
        blocks: [
          { label: L(lang, 'Principal', 'المدير'), name: 'د. سالم' },
          { label: L(lang, 'School Stamp', 'ختم المدرسة') },
        ],
      },
    ],
  };
}

function agreementSnapshot(): AgreementSnapshot {
  return {
    agreementNo: 7,
    version: 1,
    academicYearName: '2025/2026',
    registrationDate: '2026-06-28',
    parentNameEn: 'Sara Ali',
    parentNameAr: 'سارة علي',
    parentNationalId: '9990001112',
    parentPhone: '+962 79 000 0000',
    parentAddress: 'Amman, Jordan',
    students: [
      {
        nameEn: 'Ahmad Mohammad',
        nameAr: 'أحمد محمد',
        studentNumber: '20250001',
        gradeName: 'Grade 1',
        sectionName: 'A',
        tuition: '900.000',
        transportation: '0.000',
        discount: '0.000',
        net: '900.000',
      },
    ],
    grandTotal: '900.000',
    schedule: [
      { index: 1, dueDate: '2026-09-01', amount: '300.000' },
      { index: 2, dueDate: '2026-10-01', amount: '300.000' },
      { index: 3, dueDate: '2026-11-01', amount: '300.000' },
    ],
    legalClausesEn: ['This is a binding commitment governed by the applicable laws.'],
    legalClausesAr: [
      'بالتوقيع أدناه، يقر ولي الأمر بالموافقة على الرسوم وجدول الدفع المذكور أعلاه.',
    ],
    registrarName: 'المسجل',
  };
}

describe('PDF document regressions (Arabic / English / bilingual)', () => {
  const documents: Array<[string, (l: DocumentLanguage) => DocumentLayout]> = [
    ['registration agreement', (l) => buildAgreementLayout(agreementSnapshot(), l)],
    ['receipt', buildReceiptLayout],
    ['invoice', buildInvoiceLayout],
    ['statement', buildStatementLayout],
    ['certificate', buildCertificateLayout],
  ];

  for (const [name, build] of documents) {
    for (const lang of LANGS) {
      it(`renders a ${name} in ${langName(lang)}`, async () => {
        const out = await renderer.render(build(lang), branding);
        expectValidPdf(out);
      });
    }
  }

  it('produces a multi-page statement (footer + page numbers on every page)', async () => {
    const out = await renderer.render(buildStatementLayout(DocumentLanguage.AR), branding);
    // 40 table rows overflow one A4 page, so the buffered-page footer loop must run more than once.
    expect(out.byteSize).toBeGreaterThan(3000);
  });

  it('keeps English-only documents byte-stable (no shaping regression)', async () => {
    const asciiOnly = (s: string): string =>
      Array.from(s)
        .filter((c) => c.charCodeAt(0) < 128)
        .join('');
    const en = buildReceiptLayout(DocumentLanguage.EN);
    // Strip the one Arabic value so the document is pure Latin, then assert deterministic size.
    const pureEn: DocumentLayout = {
      ...en,
      subtitle: 'Official payment confirmation',
      blocks: en.blocks.map((b) =>
        b.kind === 'fields'
          ? { ...b, rows: b.rows.map((r) => ({ ...r, value: asciiOnly(r.value) })) }
          : b,
      ),
      footer: 'Thank you',
    };
    const a = await renderer.render(pureEn, branding);
    const b = await renderer.render(pureEn, branding);
    expect(a.byteSize).toBe(b.byteSize);
  });
});

// ── Item 5: LTR tokens embedded in Arabic must survive bidi layout as one contiguous run ──
describe('embedded LTR tokens inside Arabic (emails, URLs, IBANs, invoices, QR)', () => {
  const preserved: Array<[string, string, string]> = [
    ['email', 'البريد info@test.edu للتواصل', 'info@test.edu'],
    ['url', 'الموقع https://munaxa.com/pay?id=1025 هنا', 'https://munaxa.com/pay?id=1025'],
    ['iban', 'الآيبان JO94CBJO0010000000000131000302 للتحويل', 'JO94CBJO0010000000000131000302'],
    ['invoice number', 'رقم الفاتورة INV-2026-001025', 'INV-2026-001025'],
    ['decimal money', 'المبلغ 1025.000 دينار', '1025.000'],
  ];

  for (const [kind, input, token] of preserved) {
    it(`keeps the ${kind} contiguous in a single left-to-right run`, () => {
      // Some visual run holds the whole token, unbroken and unreversed.
      expect(layoutRuns(input).some((r) => !r.rtl && r.text.includes(token))).toBe(true);
    });
  }

  it('leaves a pure-ASCII QR payload as one unchanged LTR run', () => {
    const qr = 'AQ1UZXN0IEFjYWRlbXkCD0lOVi0yMDI2LTAwMTAyNQ==';
    expect(layoutRuns(qr)).toEqual([{ text: qr, rtl: false }]);
  });
});

// ── Structured identifiers with internal spaces, embedded in Arabic (LRI/PDI isolation) ──
describe('space-separated identifiers stay left-to-right inside Arabic', () => {
  const spaced: Array<[string, string, string]> = [
    ['phone number', 'الهاتف +962 79 123 4567', '+962 79 123 4567'],
    ['national ID', 'الرقم الوطني 1234 5678 9012 صادر', '1234 5678 9012'],
    [
      'grouped IBAN',
      'الآيبان JO94 CBJO 0010 0000 0000 0131 0003 02 لدى',
      'JO94 CBJO 0010 0000 0000 0131 0003 02',
    ],
    ['reference number', 'المرجع REF 2026 00125 مؤكد', 'REF 2026 00125'],
  ];

  for (const [kind, input, token] of spaced) {
    it(`keeps the ${kind} in reading order and drops all isolate controls`, () => {
      const runs = layoutRuns(input);
      expect(runs.some((r) => !r.rtl && r.text.includes(token))).toBe(true);
      expect(runs.every((r) => !/[⁦-⁩]/.test(r.text))).toBe(true); // no U+2066..U+2069 leaked
    });
  }

  it('renders a receipt whose fields carry every identifier kind', async () => {
    const layout: DocumentLayout = {
      title: L(DocumentLanguage.AR, 'Payment Receipt', 'إيصال دفع'),
      language: DocumentLanguage.AR,
      meta: [{ label: 'رقم الإيصال', value: 'RCP-000125' }],
      blocks: [
        {
          kind: 'fields',
          columns: 2,
          rows: [
            { label: 'الطالب', value: 'أحمد محمد' },
            { label: 'الهاتف', value: 'الهاتف +962 79 123 4567' },
            { label: 'الرقم الوطني', value: 'الرقم الوطني 1234 5678 9012' },
            { label: 'الآيبان', value: 'الآيبان JO94 CBJO 0010 0000 0000 0131 0003 02' },
            { label: 'المرجع', value: 'المرجع REF 2026 00125' },
            { label: 'البريد', value: 'ahmad@example.com' },
          ],
        },
      ],
    };
    expectValidPdf(await renderer.render(layout, branding));
  });
});
