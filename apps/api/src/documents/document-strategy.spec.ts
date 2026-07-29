import { DocumentPersistence, DocumentType } from '@prisma/client';
import { DOCUMENT_PERSISTENCE, isDynamic, persistenceFor } from './document-strategy';

describe('document persistence strategy', () => {
  it('marks the registration agreement (legal record) as SNAPSHOT', () => {
    expect(persistenceFor(DocumentType.REGISTRATION_AGREEMENT)).toBe(DocumentPersistence.SNAPSHOT);
    expect(isDynamic(DocumentType.REGISTRATION_AGREEMENT)).toBe(false);
  });

  it('marks every finance/operational document as DYNAMIC', () => {
    const dynamic: DocumentType[] = [
      DocumentType.PAYMENT_RECEIPT,
      DocumentType.ANNUAL_TUITION_CERTIFICATE,
      DocumentType.OUTSTANDING_BALANCE_CERTIFICATE,
      DocumentType.CLEARANCE_CERTIFICATE,
      DocumentType.ACCOUNT_STATEMENT,
      DocumentType.PAYMENT_HISTORY,
      DocumentType.FEE_BREAKDOWN,
      DocumentType.STUDENT_FINANCIAL_SUMMARY,
    ];
    for (const t of dynamic) {
      expect(persistenceFor(t)).toBe(DocumentPersistence.DYNAMIC);
      expect(isDynamic(t)).toBe(true);
    }
  });

  it('defines a strategy for every document type (no gaps)', () => {
    for (const t of Object.values(DocumentType)) {
      expect(DOCUMENT_PERSISTENCE[t]).toBeDefined();
    }
  });

  it('has exactly one SNAPSHOT type (the registration agreement)', () => {
    const snapshots = Object.values(DocumentType).filter(
      (t) => persistenceFor(t) === DocumentPersistence.SNAPSHOT,
    );
    expect(snapshots).toEqual([DocumentType.REGISTRATION_AGREEMENT]);
  });
});
