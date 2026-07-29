import { DocumentLanguage } from '@prisma/client';
import { L, amount, dateStr, docNumber, money } from './util';

describe('document template utils', () => {
  it('L() picks the right label per language', () => {
    expect(L(DocumentLanguage.EN, 'Tuition', 'الرسوم')).toBe('Tuition');
    expect(L(DocumentLanguage.AR, 'Tuition', 'الرسوم')).toBe('الرسوم');
    expect(L(DocumentLanguage.BILINGUAL, 'Tuition', 'الرسوم')).toBe('Tuition / الرسوم');
  });

  it('money() formats to 3 decimals with JOD', () => {
    expect(money('100')).toBe('100.000 JOD');
    expect(money(12.5)).toBe('12.500 JOD');
  });

  it('amount() formats to 3 decimals without suffix', () => {
    expect(amount('100')).toBe('100.000');
  });

  it('docNumber() zero-pads with a prefix', () => {
    expect(docNumber('AGR', 1)).toBe('AGR-000001');
    expect(docNumber('RCPT', 123456)).toBe('RCPT-123456');
  });

  it('dateStr() yields an ISO date or em dash', () => {
    expect(dateStr('2026-06-28T10:00:00.000Z')).toBe('2026-06-28');
    expect(dateStr(null)).toBe('—');
    expect(dateStr(undefined)).toBe('—');
  });
});
