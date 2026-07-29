import { DocumentPersistence, DocumentType } from '@prisma/client';

/**
 * Per-type persistence strategy (Phase 23b). SNAPSHOT documents are legal records whose rendered PDF
 * is stored immutably; DYNAMIC documents are operational reports rebuilt on demand from the live
 * billing ledger (metadata only — no archived PDF). New document types declare their strategy here;
 * the engine needs no other change.
 */
export const DOCUMENT_PERSISTENCE: Record<DocumentType, DocumentPersistence> = {
  // Legal commitment — immutable, reprinted from the stored snapshot.
  [DocumentType.REGISTRATION_AGREEMENT]: DocumentPersistence.SNAPSHOT,
  // Operational finance reports — always rebuilt from the ledger, never archived.
  [DocumentType.PAYMENT_RECEIPT]: DocumentPersistence.DYNAMIC,
  [DocumentType.ANNUAL_TUITION_CERTIFICATE]: DocumentPersistence.DYNAMIC,
  [DocumentType.OUTSTANDING_BALANCE_CERTIFICATE]: DocumentPersistence.DYNAMIC,
  [DocumentType.CLEARANCE_CERTIFICATE]: DocumentPersistence.DYNAMIC,
  [DocumentType.ACCOUNT_STATEMENT]: DocumentPersistence.DYNAMIC,
  [DocumentType.PAYMENT_HISTORY]: DocumentPersistence.DYNAMIC,
  [DocumentType.FEE_BREAKDOWN]: DocumentPersistence.DYNAMIC,
  [DocumentType.STUDENT_FINANCIAL_SUMMARY]: DocumentPersistence.DYNAMIC,
};

export function persistenceFor(type: DocumentType): DocumentPersistence {
  return DOCUMENT_PERSISTENCE[type] ?? DocumentPersistence.SNAPSHOT;
}

export function isDynamic(type: DocumentType): boolean {
  return persistenceFor(type) === DocumentPersistence.DYNAMIC;
}
