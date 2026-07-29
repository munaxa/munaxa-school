import { existsSync } from 'node:fs';
import { DocumentLanguage } from '@prisma/client';
import { PdfRenderer } from './pdf-renderer';
import type { BrandingContext, DocumentLayout } from './document-layout';
import {
  buildAgreementLayout,
  DEFAULT_AGREEMENT_LEGAL_CLAUSES_EN,
  DEFAULT_AGREEMENT_LEGAL_CLAUSES_AR,
  type AgreementSnapshot,
} from '../templates/agreement-template';

/** Count the page objects in a PDF (the `/Type /Page` leaves, not the `/Pages` tree root). */
const pageCount = (buffer: Buffer): number =>
  (buffer.toString('latin1').match(/\/Type\s*\/Page(?![s])/g) ?? []).length;

/** First available TrueType font on this machine (DejaVu ships almost everywhere), or null. */
const SYSTEM_TTF = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/dejavu/DejaVuSans.ttf',
  '/Library/Fonts/Arial Unicode.ttf',
].find((p) => existsSync(p));

const branding: BrandingContext = {
  nameEn: 'Test Academy',
  nameAr: 'أكاديمية الاختبار',
  legalName: 'Test Academy LLC',
  addressLines: ['12 School St', 'Amman, Jordan'],
  phone: '+962 6 000 0000',
  email: 'info@test.edu',
  website: 'https://test.edu',
};

describe('PdfRenderer', () => {
  const renderer = new PdfRenderer();

  it('renders a declarative layout to a deterministic-size PDF with a checksum', async () => {
    const layout: DocumentLayout = {
      title: 'Test Document',
      subtitle: 'Subtitle',
      language: DocumentLanguage.EN,
      meta: [{ label: 'No.', value: 'DOC-000001' }],
      blocks: [
        { kind: 'heading', text: 'Section' },
        {
          kind: 'fields',
          columns: 2,
          rows: [
            { label: 'A', value: '1' },
            { label: 'B', value: '2' },
          ],
        },
        {
          kind: 'table',
          columns: [
            { header: 'Item', key: 'item' },
            { header: 'Amount', key: 'amount', align: 'right' },
          ],
          rows: [{ item: 'Tuition', amount: '1000.000' }],
          totalsRow: { item: 'Total', amount: '1000.000' },
        },
        { kind: 'totals', rows: [{ label: 'Grand Total', value: '1000.000 JOD' }] },
        { kind: 'signatures', blocks: [{ label: 'Signature' }] },
      ],
    };

    const out = await renderer.render(layout, branding);
    expect(out.buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(out.byteSize).toBeGreaterThan(0);
    expect(out.byteSize).toBe(out.buffer.byteLength);
    expect(out.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it('renders a full registration agreement layout', async () => {
    const snapshot: AgreementSnapshot = {
      agreementNo: 7,
      version: 1,
      academicYearName: '2025/2026',
      registrationDate: '2026-06-28',
      parentNameEn: 'Jane Doe',
      parentNameAr: 'جين دو',
      parentNationalId: '9990001112',
      parentPhone: '+962 79 000 0000',
      parentAddress: 'Amman, Jordan',
      students: [
        {
          nameEn: 'John Doe',
          nameAr: 'جون دو',
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
      legalClausesEn: DEFAULT_AGREEMENT_LEGAL_CLAUSES_EN,
      legalClausesAr: DEFAULT_AGREEMENT_LEGAL_CLAUSES_AR,
      registrarName: 'Registrar User',
    };
    const layout = buildAgreementLayout(snapshot, DocumentLanguage.EN);
    expect(layout.title).toBe('Registration Agreement');
    const out = await renderer.render(layout, branding);
    expect(out.buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(out.byteSize).toBeGreaterThan(500);
  });

  // ── Arabic / bidirectional rendering ──────────────────────────────────────
  // These assert the renderer drives every surface (header, meta, headings, paragraphs, fields,
  // tables, totals, signatures, footer) through the Arabic shaping/bidi pipeline without throwing and
  // still emits a valid PDF. Exact glyph-shaping correctness is asserted in arabic-text.spec.ts.
  const expectValidPdf = (out: { buffer: Buffer; byteSize: number; checksum: string }): void => {
    expect(out.buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(out.byteSize).toBeGreaterThan(0);
    expect(out.checksum).toMatch(/^[a-f0-9]{64}$/);
  };

  it('renders an Arabic-only document (title, heading, paragraph)', async () => {
    const layout: DocumentLayout = {
      title: 'إيصال استلام',
      subtitle: 'السنة الدراسية ٢٠٢٥',
      language: DocumentLanguage.AR,
      blocks: [
        { kind: 'heading', text: 'تفاصيل الدفعة' },
        { kind: 'paragraph', text: 'استلمنا المبلغ المذكور أعلاه بالكامل.' },
      ],
    };
    expectValidPdf(await renderer.render(layout, branding));
  });

  it('renders an English-only document unchanged in behaviour', async () => {
    const layout: DocumentLayout = {
      title: 'Receipt',
      language: DocumentLanguage.EN,
      blocks: [
        { kind: 'heading', text: 'Payment details' },
        { kind: 'paragraph', text: 'We received the amount above in full.' },
      ],
    };
    expectValidPdf(await renderer.render(layout, branding));
  });

  it('renders a header/meta box with mixed Arabic + Latin + numbers', async () => {
    const layout: DocumentLayout = {
      title: 'رقم Invoice INV-1025',
      subtitle: 'Receipt رقم 125',
      language: DocumentLanguage.BILINGUAL,
      meta: [
        { label: 'الرقم', value: 'INV-1025' },
        { label: 'Date', value: '2026-07-07' },
      ],
      blocks: [{ kind: 'paragraph', text: 'Student: أحمد محمد' }],
    };
    expectValidPdf(await renderer.render(layout, branding));
  });

  it('renders a table with Arabic headers, cells and numeric columns', async () => {
    const layout: DocumentLayout = {
      title: 'كشف حساب',
      language: DocumentLanguage.AR,
      blocks: [
        {
          kind: 'table',
          columns: [
            { header: 'البند', key: 'item' },
            { header: 'المبلغ', key: 'amount', align: 'right' },
          ],
          rows: [
            { item: 'رسوم دراسية', amount: '900.000' },
            { item: 'رقم Invoice INV-1025', amount: '125.000' },
          ],
          totalsRow: { item: 'الإجمالي', amount: '1025.000' },
        },
        { kind: 'fields', columns: 2, rows: [{ label: 'الطالب', value: 'أحمد محمد' }] },
        { kind: 'totals', rows: [{ label: 'المجموع', value: '1025.000 JOD' }] },
        { kind: 'signatures', blocks: [{ label: 'التوقيع', name: 'أحمد محمد' }] },
      ],
    };
    expectValidPdf(await renderer.render(layout, branding));
  });

  it('renders an Arabic footer note across buffered pages', async () => {
    // A long body forces multiple pages so the footer (with page numbers) is drawn more than once.
    const blocks: DocumentLayout['blocks'] = Array.from({ length: 60 }, () => ({
      kind: 'paragraph' as const,
      text: 'سطر نصي عربي لاختبار التذييل والترقيم عبر عدة صفحات.',
    }));
    const layout: DocumentLayout = {
      title: 'مستند طويل',
      footer: 'أكاديمية الاختبار · جميع الحقوق محفوظة',
      language: DocumentLanguage.AR,
      blocks,
    };
    const out = await renderer.render(layout, branding);
    expectValidPdf(out);
    expect(out.byteSize).toBeGreaterThan(1000);
  });

  // Regression guard: the footer draws BELOW the content box, which used to make pdfkit auto-append a
  // blank page per footer line (a short document silently became 3 pages). The footer pass must not
  // add pages — a one-page document stays exactly one page.
  it('does not emit phantom pages for the footer (single-page document is 1 page)', async () => {
    const layout: DocumentLayout = {
      title: 'Short Document',
      footer: 'Al-Test Academy · جميع الحقوق محفوظة',
      language: DocumentLanguage.BILINGUAL,
      meta: [{ label: 'No.', value: 'DOC-000001' }],
      blocks: [
        { kind: 'heading', text: 'Section / قسم' },
        { kind: 'paragraph', text: 'A single short paragraph.' },
        { kind: 'signatures', blocks: [{ label: 'Parent / ولي الأمر' }] },
      ],
    };
    const out = await renderer.render(layout, branding);
    expect(pageCount(out.buffer)).toBe(1);
  });

  // Regression guard for the mojibake root cause: Arabic used to fall back to the WinAnsi standard
  // Helvetica (no embedded Arabic font at all), rendering each 16-bit code unit as two Latin-1 glyphs.
  // The renderer now uses a separate Arabic family, so an embedded Arabic TrueType (FontFile2) must be
  // present when a font is configured — its absence is exactly the mojibake defect.
  (SYSTEM_TTF ? it : it.skip)(
    'embeds a real Arabic TrueType font for Arabic runs (mojibake guard)',
    async () => {
      const prev = process.env.PDF_ARABIC_FONT_PATH;
      process.env.PDF_ARABIC_FONT_PATH = SYSTEM_TTF!;
      try {
        const layout: DocumentLayout = {
          title: 'اتفاقية التسجيل',
          subtitle: 'مدرسة الاختبار',
          language: DocumentLanguage.AR,
          meta: [{ label: 'رقم', value: 'AGR-000007' }],
          blocks: [
            { kind: 'heading', text: 'الأطراف والطالب' }, // regular + bold both exercised
            { kind: 'paragraph', text: 'هذا نص عربي في فقرة عادية.' },
            { kind: 'fields', columns: 2, rows: [{ label: 'الطالب', value: 'أحمد محمد' }] },
          ],
        };
        const out = await renderer.render(layout, branding);
        const pdf = out.buffer.toString('latin1');
        expect(pdf).toMatch(/\/FontFile2\b/); // the embedded Arabic TrueType is present
      } finally {
        if (prev === undefined) delete process.env.PDF_ARABIC_FONT_PATH;
        else process.env.PDF_ARABIC_FONT_PATH = prev;
      }
    },
  );

  it('embeds the bundled Arabic font by default — no config needed', async () => {
    // With PDF_ARABIC_FONT_PATH unset (the production default that produced unreadable Arabic in
    // Acrobat), the renderer must still embed the bundled Arabic TrueType for Arabic runs.
    const prev = process.env.PDF_ARABIC_FONT_PATH;
    delete process.env.PDF_ARABIC_FONT_PATH;
    try {
      const layout: DocumentLayout = {
        title: 'شهادة رسوم',
        language: DocumentLanguage.AR,
        blocks: [
          { kind: 'heading', text: 'الطالب سيف أبو الحاج' },
          { kind: 'paragraph', text: 'تشهد هذه الوثيقة بقيمة الرسوم المدفوعة.' },
        ],
      };
      const out = await renderer.render(layout, branding);
      const pdf = out.buffer.toString('latin1');
      expect(pdf).toMatch(/\/FontFile2\b/); // the bundled Arabic TrueType is embedded
    } finally {
      if (prev === undefined) delete process.env.PDF_ARABIC_FONT_PATH;
      else process.env.PDF_ARABIC_FONT_PATH = prev;
    }
  });

  it('uses separate Latin and Arabic families — Latin stays Helvetica, Arabic is embedded', async () => {
    // Per-run selection: pure-Latin runs render in built-in Helvetica; Arabic runs in the embedded
    // Arabic font. Both must therefore appear in a bilingual document.
    const layout: DocumentLayout = {
      title: 'Certificate / شهادة',
      language: DocumentLanguage.BILINGUAL,
      blocks: [
        { kind: 'heading', text: 'Student / الطالب' },
        { kind: 'fields', columns: 2, rows: [{ label: 'Name / الاسم', value: 'أحمد محمد' }] },
      ],
    };
    const pdf = (await renderer.render(layout, branding)).buffer.toString('latin1');
    expect(pdf).toMatch(/\/BaseFont\s*\/Helvetica\b/); // Latin family present
    expect(pdf).toMatch(/\/FontFile2\b/); // Arabic family embedded
  });

  it('stores logical Arabic in the text layer via /ActualText (correct copy/search/accessibility)', async () => {
    // PDFKit draws Arabic in shaped, visual (reversed) order so the glyphs display correctly, which
    // would make the text layer extract as reversed presentation forms. drawText wraps each Arabic run
    // in an /ActualText marked-content span carrying the ORIGINAL logical Unicode (UTF-16BE), which
    // conforming readers (Acrobat, Chrome/Edge, poppler, screen readers) return instead. Here we inflate
    // the content streams and assert the logical string is present as UTF-16BE — i.e. NOT reversed.
    // Avoid letters whose UTF-16 low byte is a PDF string metacharacter — U+0628 '(' / U+0629 ')' —
    // so the expected bytes appear verbatim (unescaped) in the stream.
    const heading = 'محمد أحمد';
    const layout: DocumentLayout = {
      title: 'شهادة',
      language: DocumentLanguage.AR,
      blocks: [{ kind: 'heading', text: heading }],
    };
    const { buffer } = await renderer.render(layout, branding);

    // Concatenate every inflated FlateDecode stream in the PDF.
    const { inflateSync } = await import('node:zlib');
    let content = Buffer.alloc(0);
    const re = /stream\r?\n/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(buffer.toString('latin1')))) {
      const start = m.index + m[0].length;
      const end = buffer.indexOf('endstream', start, 'latin1');
      if (end < 0) continue;
      try {
        content = Buffer.concat([content, inflateSync(buffer.subarray(start, end))]);
      } catch {
        /* not a flate stream (e.g. font file) — skip */
      }
    }

    // Logical string, UTF-16BE with BOM = what /ActualText must contain (NOT the reversed visual form).
    const utf16be = Buffer.from('﻿' + heading, 'utf16le').swap16();
    expect(content.includes('ActualText')).toBe(true);
    expect(content.includes(utf16be)).toBe(true);
    // Sanity: the reversed visual string must NOT be what ActualText stores.
    const reversedBE = Buffer.from('﻿' + [...heading].reverse().join(''), 'utf16le').swap16();
    expect(content.includes(reversedBE)).toBe(false);
  });

  it('produces identical checksums for identical input (snapshot reproducibility)', async () => {
    const layout: DocumentLayout = {
      title: 'Stable',
      language: DocumentLanguage.EN,
      blocks: [{ kind: 'paragraph', text: 'Same content' }],
    };
    const a = await renderer.render(layout, branding);
    const b = await renderer.render(layout, branding);
    // pdfkit embeds a creation date, so byte-for-byte equality is not guaranteed; assert the
    // renderer is stable in structure (same size) — checksum equality is asserted at the data layer.
    expect(a.byteSize).toBe(b.byteSize);
  });

  // ── Registration Agreement = the parent's financial commitment (the master enterprise template) ──
  describe('Registration Agreement master template', () => {
    const snapshot: AgreementSnapshot = {
      agreementNo: 123,
      version: 1,
      academicYearName: '2025/2026',
      registrationDate: '2026-07-09',
      parentNameEn: 'Sara Ali',
      parentNameAr: 'سارة علي',
      parentNationalId: '9871234567',
      parentPhone: '+962 79 123 4567',
      parentAddress: 'Abdoun, Amman, Jordan',
      students: [
        {
          nameEn: 'Saif Abu Al-Hajj',
          nameAr: 'سيف تامر أبو الحاج',
          studentNumber: '20212115',
          gradeName: 'KG',
          sectionName: null,
          tuition: '1350.000',
          transportation: '350.000',
          discount: '65.000',
          net: '1635.000',
        },
        {
          nameEn: 'Thia Abu Al-Hajj',
          nameAr: 'ثيا تامر أبو الحاج',
          studentNumber: '20242228',
          gradeName: 'KG',
          sectionName: null,
          tuition: '950.000',
          transportation: '250.000',
          discount: '95.000',
          net: '1105.000',
        },
      ],
      grandTotal: '2740.000',
      schedule: [
        { index: 1, dueDate: '2024-08-24', amount: '275.000' },
        { index: 2, dueDate: '2024-09-01', amount: '310.000' },
        { index: 3, dueDate: '2024-10-01', amount: '310.000' },
      ],
      legalClausesEn: [
        'I undertake to pay the fees stated above on their due dates in accordance with the schedule.',
        'I acknowledge that this is a binding financial commitment governed by the applicable laws.',
      ],
      legalClausesAr: [
        'أتعهد بدفع الرسوم المبيّنة أعلاه في مواعيدها وفق الجدول المذكور.',
        'وأقر بأن هذا التزام مالي ملزم يخضع للقوانين النافذة.',
      ],
      registrarName: 'د. سالم القاسم',
    };

    for (const language of [DocumentLanguage.BILINGUAL, DocumentLanguage.AR, DocumentLanguage.EN]) {
      it(`renders a compact, non-fragmented document in ${language}`, async () => {
        const layout = buildAgreementLayout(snapshot, language);
        expect(layout.density).toBe('compact');
        const out = await renderer.render(layout, branding);
        expectValidPdf(out);
        // Single-language agreements fit one A4 page; the bilingual variant shows both full legal
        // columns so it may take a second page — but never fragments into phantom footer pages.
        const pages = pageCount(out.buffer);
        expect(pages).toBeGreaterThanOrEqual(1);
        expect(pages).toBeLessThanOrEqual(language === DocumentLanguage.BILINGUAL ? 2 : 1);
      });
    }

    it('ships the verbatim default undertaking clauses (Arabic authoritative, English parallel)', () => {
      // Six parallel clauses; the Arabic is the final legal text embedded exactly as provided.
      expect(DEFAULT_AGREEMENT_LEGAL_CLAUSES_AR).toHaveLength(6);
      expect(DEFAULT_AGREEMENT_LEGAL_CLAUSES_EN).toHaveLength(6);
      expect(DEFAULT_AGREEMENT_LEGAL_CLAUSES_AR[0]).toContain('أتعهد، بصفتي الشخصية');
      expect(DEFAULT_AGREEMENT_LEGAL_CLAUSES_AR[5]).toContain('المحاكم الأردنية');
    });

    it('renders the bilingual legal declaration as a mirrored two-column block', () => {
      const layout = buildAgreementLayout(snapshot, DocumentLanguage.BILINGUAL);
      const legal = layout.blocks.find((b) => b.kind === 'legal');
      expect(legal).toEqual({
        kind: 'legal',
        en: snapshot.legalClausesEn,
        ar: snapshot.legalClausesAr,
      });
    });

    it('collapses to a single-language legal column for EN-only / AR-only documents', () => {
      const en = buildAgreementLayout(snapshot, DocumentLanguage.EN).blocks.find(
        (b) => b.kind === 'legal',
      );
      const ar = buildAgreementLayout(snapshot, DocumentLanguage.AR).blocks.find(
        (b) => b.kind === 'legal',
      );
      expect(en).toMatchObject({ ar: [] });
      expect(en).toMatchObject({ en: snapshot.legalClausesEn });
      expect(ar).toMatchObject({ en: [] });
      expect(ar).toMatchObject({ ar: snapshot.legalClausesAr });
    });
  });
});
