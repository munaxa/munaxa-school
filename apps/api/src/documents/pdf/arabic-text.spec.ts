import { baseDirection, containsArabic, layoutRuns, type VisualRun } from './arabic-text';

/** Concatenate run texts in visual order — handy for asserting nothing is dropped. */
const joined = (runs: VisualRun[]): string => runs.map((r) => r.text).join('');

describe('arabic-text', () => {
  describe('containsArabic', () => {
    it('detects Arabic base letters and shaped forms', () => {
      expect(containsArabic('أحمد')).toBe(true);
      expect(containsArabic('Receipt رقم 125')).toBe(true);
      expect(containsArabic('ﺍ')).toBe(true); // presentation form
    });
    it('is false for English, numbers and punctuation only', () => {
      expect(containsArabic('Invoice INV-1025')).toBe(false);
      expect(containsArabic('1,000.000 JOD')).toBe(false);
      expect(containsArabic('')).toBe(false);
    });
    it('detects Persian/Urdu letters', () => {
      expect(containsArabic('گچپ')).toBe(true);
      expect(containsArabic('ٹڈ')).toBe(true);
    });
  });

  describe('layoutRuns', () => {
    it('returns a single unchanged run for pure Latin/numeric text (fast path)', () => {
      expect(layoutRuns('Invoice INV-1025')).toEqual([{ text: 'Invoice INV-1025', rtl: false }]);
      expect(layoutRuns('')).toEqual([{ text: '', rtl: false }]);
    });

    it('keeps a pure-Arabic phrase as one RTL run in logical order (font shapes it)', () => {
      // Text stays LOGICAL — the font's shaper joins it; only the run direction is marked RTL.
      expect(layoutRuns('أحمد محمد')).toEqual([{ text: 'أحمد محمد', rtl: true }]);
    });

    it('orders mixed Latin+Arabic runs left-to-right for display', () => {
      expect(layoutRuns('Student: أحمد محمد')).toEqual([
        { text: 'Student: ', rtl: false },
        { text: 'أحمد محمد', rtl: true },
      ]);
    });

    it('places the Latin run first (leftmost) in an RTL-led phrase', () => {
      expect(layoutRuns('رقم Invoice INV-1025')).toEqual([
        { text: 'Invoice INV-1025', rtl: false },
        { text: 'رقم ', rtl: true },
      ]);
    });

    it('never drops or duplicates characters (ignoring NFC/isolates)', () => {
      const runs = layoutRuns('البريد info@test.edu للتواصل');
      expect(joined(runs)).toContain('info@test.edu');
      expect(joined(runs)).toContain('البريد');
      expect(joined(runs)).toContain('للتواصل');
    });

    it('normalizes to NFC before splitting', () => {
      // U+0627 ALEF + U+0654 COMBINING HAMZA ABOVE --NFC--> U+0623.
      const runs = layoutRuns('أ');
      expect(runs).toEqual([{ text: 'أ', rtl: true }]);
      expect(runs[0]!.text.codePointAt(0)).toBe(0x0623);
    });
  });

  describe('layoutRuns — structured identifiers stay left-to-right', () => {
    const cases: Array<[string, string]> = [
      ['phone', 'الهاتف +962 79 123 4567'],
      ['national ID', 'الرقم الوطني 1234 5678 9012'],
      ['grouped IBAN', 'الآيبان JO94 CBJO 0010 0000 0000 0131 0003 02'],
      ['invoice number', 'رقم الفاتورة INV-2026-001025'],
    ];
    for (const [kind, input] of cases) {
      it(`keeps the ${kind} contiguous in one LTR run`, () => {
        const runs = layoutRuns(input);
        const ltr = runs.find((r) => !r.rtl);
        expect(ltr).toBeDefined();
        // The identifier survives as a single contiguous left-to-right run (groups not reversed).
        const token = input.match(/[A-Za-z0-9+][A-Za-z0-9+/@._ -]*\d/)![0].trim();
        expect(ltr!.text.replace(/\s+/g, ' ')).toContain(token.replace(/\s+/g, ' '));
      });
    }

    it('does not isolate a single number or an email (no internal spaces)', () => {
      expect(layoutRuns('المبلغ 1025.000 دينار').some((r) => r.text.includes('1025.000'))).toBe(
        true,
      );
      expect(layoutRuns('البريد a@b.com').some((r) => r.text === 'a@b.com')).toBe(true);
    });
  });

  describe('baseDirection', () => {
    it('is rtl when the string leads with Arabic', () => {
      expect(baseDirection('رقم Invoice')).toBe('rtl');
    });
    it('is ltr when the string leads with Latin', () => {
      expect(baseDirection('Receipt رقم 125')).toBe('ltr');
      expect(baseDirection('Invoice INV-1025')).toBe('ltr');
    });
  });
});
