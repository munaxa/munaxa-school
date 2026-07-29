import type { DocumentLanguage } from '@prisma/client';

/**
 * Declarative document layout. Templates never draw to the PDF canvas directly — they emit one of
 * these structures, and {@link PdfRenderer} turns it into an A4 PDF with the school branding.
 *
 * This keeps document layouts data-driven (Part 3 requirement: "never hardcode document layouts"):
 * adding a new document type is a new function that returns a `DocumentLayout`, not new drawing code.
 */

/** A school-branding header/footer context, resolved from OrganizationSettings (Part 7). */
export interface BrandingContext {
  nameEn: string;
  nameAr?: string | undefined;
  legalName?: string | undefined;
  addressLines: string[];
  phone?: string | undefined;
  email?: string | undefined;
  website?: string | undefined;
  /** Free-text shown in the document footer (tenant-configurable). */
  footerNote?: string | undefined;
  /** PNG/JPEG logo bytes for the header (optional — text header is used when absent). */
  logo?: Buffer | undefined;
  /** Stamp image bytes for the signatures area (optional). */
  stamp?: Buffer | undefined;
  /** Signature image bytes (optional). */
  signature?: Buffer | undefined;
}

export type Align = 'left' | 'right' | 'center';

export interface FieldRow {
  label: string;
  value: string;
}

export interface TableColumn {
  header: string;
  key: string;
  align?: Align;
  /** Relative width weight (defaults to 1). */
  width?: number;
}

export type LayoutBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string; muted?: boolean }
  | { kind: 'fields'; columns?: number; rows: FieldRow[] }
  | {
      kind: 'table';
      columns: TableColumn[];
      rows: Array<Record<string, string | number>>;
      totalsRow?: Record<string, string | number>;
      /** Tighten row height + vertical padding to save vertical space (e.g. a long payment schedule). */
      dense?: boolean;
    }
  | { kind: 'totals'; rows: FieldRow[] }
  // Mirrored bilingual legal clauses: English numbered list on the left, Arabic numbered list on the
  // right. When only one side is present it fills the width as a single numbered column (LTR for `en`,
  // RTL for `ar`) — so an English-only or Arabic-only document collapses to one column automatically.
  | { kind: 'legal'; en: string[]; ar: string[] }
  | { kind: 'signatures'; blocks: Array<{ label: string; name?: string }> }
  | { kind: 'spacer'; size?: number };

/** A complete, render-ready document. */
export interface DocumentLayout {
  title: string;
  subtitle?: string;
  /** Top-right metadata box (document number, issue date, version, …). */
  meta?: FieldRow[];
  blocks: LayoutBlock[];
  /** Overrides the branding footer note for this document. */
  footer?: string;
  language?: DocumentLanguage;
  /** Type/spacing density. 'compact' shrinks the type ramp and spacing so a dense document fits fewer
   * pages (e.g. a single-page commitment). Omitted / 'default' renders at the standard scale. */
  density?: 'default' | 'compact';
}
