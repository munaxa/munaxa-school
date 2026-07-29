import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BrandingService } from './branding.service';
import { PdfRenderer, type RenderedPdf } from './pdf/pdf-renderer';
import { DocumentRepository, type DocumentMeta } from './document.repository';
import { isDynamic } from './document-strategy';
import type { BuiltDocument, DocumentParams } from './document.types';
import type { BrandingContext, DocumentLayout } from './pdf/document-layout';

/**
 * The reusable Document Engine core (Part 3 + Phase 23b). It applies the per-type persistence
 * strategy:
 *
 *  • SNAPSHOT — render the PDF and archive it immutably (legal records).
 *  • DYNAMIC  — persist metadata + re-render params only; the PDF is produced on demand and
 *    discarded (operational reports). No binary storage, no duplicate financial data.
 *
 * Shared by the finance builders and the registration-agreement flow (which adds versioning).
 */
@Injectable()
export class DocumentEngineService {
  constructor(
    private readonly branding: BrandingService,
    private readonly renderer: PdfRenderer,
    private readonly repo: DocumentRepository,
  ) {}

  /** Resolve branding once (callers that render + persist separately, e.g. agreements). */
  resolveBranding(): Promise<BrandingContext> {
    return this.branding.forTenant();
  }

  render(layout: DocumentLayout, branding: BrandingContext): Promise<RenderedPdf> {
    return this.renderer.render(layout, branding);
  }

  /** Render a built document to a PDF buffer using the tenant's branding (streaming/on-demand). */
  async renderBuilt(built: BuiltDocument): Promise<RenderedPdf> {
    const branding = await this.branding.forTenant();
    return this.renderer.render(built.layout, branding);
  }

  /**
   * Persist a built document according to its strategy and return the archive metadata. SNAPSHOT
   * documents store the rendered PDF; DYNAMIC documents store metadata + `params` only (re-rendered
   * on demand). The GENERATE access event is recorded by the repository in the same transaction.
   */
  async persist(built: BuiltDocument, params: DocumentParams): Promise<DocumentMeta> {
    if (isDynamic(built.type)) {
      return this.repo.persistDynamicMetadata({
        type: built.type,
        title: built.layout.title,
        language: built.language,
        studentId: built.studentId ?? null,
        parentId: built.parentId ?? null,
        academicYearId: built.academicYearId ?? null,
        enrollmentId: built.enrollmentId ?? null,
        paymentId: built.paymentId ?? null,
        params: params as unknown as Prisma.InputJsonValue,
      });
    }
    // SNAPSHOT: render once and archive the immutable PDF.
    const branding = await this.branding.forTenant();
    const rendered = await this.renderer.render(built.layout, branding);
    return this.repo.archiveDocument({
      type: built.type,
      title: built.layout.title,
      language: built.language,
      studentId: built.studentId ?? null,
      parentId: built.parentId ?? null,
      academicYearId: built.academicYearId ?? null,
      enrollmentId: built.enrollmentId ?? null,
      paymentId: built.paymentId ?? null,
      ...(built.dataSnapshot !== undefined ? { dataSnapshot: built.dataSnapshot } : {}),
      pdf: rendered.buffer,
      checksum: rendered.checksum,
      byteSize: rendered.byteSize,
    });
  }
}
