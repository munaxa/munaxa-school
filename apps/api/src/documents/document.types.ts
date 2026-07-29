import type { DocumentLanguage, DocumentType, FeeItemKind, Prisma } from '@prisma/client';
import type { DocumentLayout } from './pdf/document-layout';

/**
 * The inputs needed to (re)build a document. For DYNAMIC documents these are stored verbatim on the
 * metadata row (`GeneratedDocument.params`) so the PDF can be re-rendered on demand from live data —
 * no archived PDF. Kept deliberately small (references + options), never financial figures.
 */
export interface DocumentParams {
  type: DocumentType;
  language: DocumentLanguage;
  studentId?: string;
  paymentId?: string;
  academicYearId?: string;
  /** Calendar year (e.g. 2026) for the Annual Tuition Certificate — 1 Jan … 31 Dec of this year. */
  year?: number;
  includeKinds?: FeeItemKind[];
}

/**
 * A built-but-not-yet-persisted document: the declarative layout + the archive references. The
 * Document Engine decides whether to store the rendered PDF (SNAPSHOT) or only metadata (DYNAMIC).
 */
export interface BuiltDocument {
  type: DocumentType;
  language: DocumentLanguage;
  layout: DocumentLayout;
  studentId?: string | null;
  parentId?: string | null;
  academicYearId?: string | null;
  enrollmentId?: string | null;
  paymentId?: string | null;
  /** Captured only for SNAPSHOT documents (forensics); ignored for DYNAMIC ones. */
  dataSnapshot?: Prisma.InputJsonValue;
}

/** Request context for the access history (best-effort; populated from the HTTP request). */
export interface AccessContext {
  ip?: string | undefined;
  userAgent?: string | undefined;
}
