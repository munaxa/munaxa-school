import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AdmissionStatus,
  DocumentAccessAction,
  DocumentAccessStatus,
  DocumentLanguage,
  DocumentPersistence,
  DocumentType,
  PaymentStatus,
  Prisma,
  RegistrationAgreementStatus,
} from '@prisma/client';
import { TenantRepository } from '../common/tenant.repository';
import { TenantContextStore } from '../prisma/tenant-context';
import type { TxClient } from '../prisma/tenant.helpers';
import type { AccessContext } from './document.types';

/** Columns returned for archive listings — deliberately excludes the (large) `pdf` bytea. */
const META_SELECT = {
  id: true,
  documentNo: true,
  type: true,
  persistence: true,
  title: true,
  language: true,
  status: true,
  version: true,
  studentId: true,
  parentId: true,
  academicYearId: true,
  enrollmentId: true,
  paymentId: true,
  checksum: true,
  byteSize: true,
  printedCount: true,
  downloadCount: true,
  emailCount: true,
  lastPrintedAt: true,
  lastDownloadedAt: true,
  lastEmailedAt: true,
  lastPrintedById: true,
  lastDownloadedById: true,
  lastEmailedById: true,
  generatedById: true,
  generatedAt: true,
  createdAt: true,
} satisfies Prisma.GeneratedDocumentSelect;

export type DocumentMeta = Prisma.GeneratedDocumentGetPayload<{ select: typeof META_SELECT }>;

export interface ArchiveDocumentInput {
  type: DocumentType;
  title: string;
  language: DocumentLanguage;
  persistence?: DocumentPersistence;
  studentId?: string | null;
  parentId?: string | null;
  academicYearId?: string | null;
  enrollmentId?: string | null;
  paymentId?: string | null;
  version?: number;
  dataSnapshot?: Prisma.InputJsonValue;
  pdf: Buffer;
  checksum: string;
  byteSize: number;
}

/** Metadata-only persistence for a DYNAMIC document (no PDF; rebuilt on demand from `params`). */
export interface DynamicMetadataInput {
  type: DocumentType;
  title: string;
  language: DocumentLanguage;
  studentId?: string | null;
  parentId?: string | null;
  academicYearId?: string | null;
  enrollmentId?: string | null;
  paymentId?: string | null;
  params: Prisma.InputJsonValue;
}

@Injectable()
export class DocumentRepository extends TenantRepository {
  private actor(): string | null {
    return TenantContextStore.get()?.actorUserId ?? null;
  }

  /**
   * Allocate the next gapless number for a per-tenant scope (row-locked, lazily created) — identical
   * to the PaymentReceiptCounter / JoFotara ICV pattern, so numbers are sequential with no gaps.
   */
  private async nextNumber(tx: TxClient, tenantId: string, scope: string): Promise<number> {
    await tx.$executeRaw`
      INSERT INTO "DocumentSequence" ("id","tenantId","scope")
      VALUES (gen_random_uuid(), ${tenantId}::uuid, ${scope})
      ON CONFLICT ("tenantId","scope") DO NOTHING`;
    const rows = await tx.$queryRaw<{ next: number }[]>`
      UPDATE "DocumentSequence" SET "nextNo" = "nextNo" + 1
      WHERE "tenantId" = ${tenantId}::uuid AND "scope" = ${scope}
      RETURNING "nextNo" - 1 AS "next"`;
    return rows[0]!.next;
  }

  /** Archive a freshly-rendered document (own transaction). Audited as a generation event. */
  archiveDocument(input: ArchiveDocumentInput): Promise<DocumentMeta> {
    return this.run(async (tx, tenantId) => this.archiveInTx(tx, tenantId, input));
  }

  /** Archive a SNAPSHOT document within an existing transaction (used by the agreement flow). */
  async archiveInTx(
    tx: TxClient,
    tenantId: string,
    input: ArchiveDocumentInput,
  ): Promise<DocumentMeta> {
    const documentNo = await this.nextNumber(tx, tenantId, `DOC:${input.type}`);
    const doc = await tx.generatedDocument.create({
      data: {
        tenantId,
        documentNo,
        type: input.type,
        persistence: input.persistence ?? DocumentPersistence.SNAPSHOT,
        title: input.title,
        language: input.language,
        version: input.version ?? 1,
        studentId: input.studentId ?? null,
        parentId: input.parentId ?? null,
        academicYearId: input.academicYearId ?? null,
        enrollmentId: input.enrollmentId ?? null,
        paymentId: input.paymentId ?? null,
        dataSnapshot: input.dataSnapshot ?? Prisma.JsonNull,
        // Normalise to a plain Uint8Array<ArrayBuffer> for the Prisma Bytes column (Node 22's
        // Buffer<ArrayBufferLike> is not directly assignable).
        pdf: new Uint8Array(input.pdf),
        checksum: input.checksum,
        byteSize: input.byteSize,
        generatedById: this.actor(),
      },
      select: META_SELECT,
    });
    await this.recordAccessInTx(tx, tenantId, doc.id, input.type, DocumentAccessAction.GENERATE);
    await this.writeAudit(tx, tenantId, {
      action: 'document.generate',
      entityType: 'GeneratedDocument',
      entityId: doc.id,
      metadata: { type: input.type, documentNo, checksum: input.checksum },
    });
    return doc;
  }

  /** Persist a DYNAMIC document as metadata only (no PDF). The GENERATE action is recorded. */
  persistDynamicMetadata(input: DynamicMetadataInput): Promise<DocumentMeta> {
    return this.run(async (tx, tenantId) => {
      const documentNo = await this.nextNumber(tx, tenantId, `DOC:${input.type}`);
      const doc = await tx.generatedDocument.create({
        data: {
          tenantId,
          documentNo,
          type: input.type,
          persistence: DocumentPersistence.DYNAMIC,
          title: input.title,
          language: input.language,
          studentId: input.studentId ?? null,
          parentId: input.parentId ?? null,
          academicYearId: input.academicYearId ?? null,
          enrollmentId: input.enrollmentId ?? null,
          paymentId: input.paymentId ?? null,
          params: input.params,
          generatedById: this.actor(),
        },
        select: META_SELECT,
      });
      await this.recordAccessInTx(tx, tenantId, doc.id, input.type, DocumentAccessAction.GENERATE);
      await this.writeAudit(tx, tenantId, {
        action: 'document.generate',
        entityType: 'GeneratedDocument',
        entityId: doc.id,
        metadata: { type: input.type, documentNo, persistence: 'DYNAMIC' },
      });
      return doc;
    });
  }

  /** Write a DocumentAccessLog row + bump the matching denormalised counter (within a tx). */
  private async recordAccessInTx(
    tx: TxClient,
    tenantId: string,
    documentId: string,
    documentType: DocumentType,
    action: DocumentAccessAction,
    ctx?: AccessContext,
    status: DocumentAccessStatus = DocumentAccessStatus.SUCCESS,
  ): Promise<void> {
    await tx.documentAccessLog.create({
      data: {
        tenantId,
        documentId,
        documentType,
        action,
        status,
        actorUserId: this.actor(),
        ip: ctx?.ip ?? null,
        userAgent: ctx?.userAgent ?? null,
      },
    });
    if (status !== DocumentAccessStatus.SUCCESS) return;
    const now = new Date();
    const actor = this.actor();
    const counter: Prisma.GeneratedDocumentUpdateInput =
      action === DocumentAccessAction.PRINT
        ? { printedCount: { increment: 1 }, lastPrintedAt: now, lastPrintedById: actor }
        : action === DocumentAccessAction.DOWNLOAD
          ? { downloadCount: { increment: 1 }, lastDownloadedAt: now, lastDownloadedById: actor }
          : action === DocumentAccessAction.EMAIL
            ? { emailCount: { increment: 1 }, lastEmailedAt: now, lastEmailedById: actor }
            : {};
    if (Object.keys(counter).length > 0) {
      await tx.generatedDocument.update({ where: { id: documentId }, data: counter });
    }
  }

  listDocuments(filter: {
    studentId?: string;
    type?: DocumentType;
    enrollmentId?: string;
  }): Promise<DocumentMeta[]> {
    return this.run((tx) =>
      tx.generatedDocument.findMany({
        where: {
          ...(filter.studentId ? { studentId: filter.studentId } : {}),
          ...(filter.type ? { type: filter.type } : {}),
          ...(filter.enrollmentId ? { enrollmentId: filter.enrollmentId } : {}),
        },
        select: META_SELECT,
        orderBy: { generatedAt: 'desc' },
        take: 500,
      }),
    );
  }

  getMeta(id: string): Promise<DocumentMeta | null> {
    return this.run((tx) => tx.generatedDocument.findFirst({ where: { id }, select: META_SELECT }));
  }

  /**
   * Load a document for serving: its metadata, persistence strategy, the stored PDF (SNAPSHOT only)
   * and the re-render params (DYNAMIC only). No side effects — the caller records the access action.
   */
  async documentForServe(id: string): Promise<{
    meta: DocumentMeta;
    persistence: DocumentPersistence;
    pdf: Buffer | null;
    params: unknown;
  }> {
    return this.run(async (tx) => {
      const doc = await tx.generatedDocument.findFirst({ where: { id } });
      if (!doc) throw new NotFoundException('Document not found');
      const { pdf, params, ...rest } = doc;
      return {
        meta: rest as unknown as DocumentMeta,
        persistence: doc.persistence,
        pdf: pdf ? Buffer.from(pdf) : null,
        params: params ?? null,
      };
    });
  }

  /** Record an access action (PRINT/DOWNLOAD/EMAIL/VIEW) in its own transaction + mirror to audit. */
  recordAccess(
    id: string,
    action: DocumentAccessAction,
    ctx?: AccessContext,
    status: DocumentAccessStatus = DocumentAccessStatus.SUCCESS,
  ): Promise<void> {
    return this.run(async (tx, tenantId) => {
      const doc = await tx.generatedDocument.findFirst({
        where: { id },
        select: { id: true, type: true, documentNo: true },
      });
      if (!doc) throw new NotFoundException('Document not found');
      await this.recordAccessInTx(tx, tenantId, id, doc.type, action, ctx, status);
      await this.writeAudit(tx, tenantId, {
        action: `document.${action.toLowerCase()}`,
        entityType: 'GeneratedDocument',
        entityId: id,
        metadata: { type: doc.type, documentNo: doc.documentNo, status },
      });
    });
  }

  /** Full per-action access history for a document (newest first). */
  accessHistory(id: string) {
    return this.run((tx) =>
      tx.documentAccessLog.findMany({
        where: { documentId: id },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    );
  }

  /** Persist email-delivery metadata (no attachment stored). */
  logDocumentEmail(input: {
    documentId: string;
    recipients: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string | null;
    providerResponse?: string | null;
    status: DocumentAccessStatus;
    retryCount?: number;
  }): Promise<unknown> {
    return this.run((tx, tenantId) =>
      tx.documentEmailLog.create({
        data: {
          tenantId,
          documentId: input.documentId,
          sentById: this.actor(),
          recipients: input.recipients,
          cc: input.cc ?? [],
          bcc: input.bcc ?? [],
          subject: input.subject ?? null,
          providerResponse: input.providerResponse ?? null,
          status: input.status,
          retryCount: input.retryCount ?? 0,
        },
      }),
    );
  }

  emailHistory(id: string) {
    return this.run((tx) =>
      tx.documentEmailLog.findMany({
        where: { documentId: id },
        orderBy: { sentAt: 'desc' },
        take: 200,
      }),
    );
  }

  // ── Registration agreements ────────────────────────────────────────────────

  /**
   * The single (non-cancelled) registration agreement for an enrollment, with its document meta —
   * or null. Used to enforce "exactly one immutable agreement per enrollment" (idempotent generate).
   */
  agreementByEnrollment(enrollmentId: string) {
    return this.run((tx) =>
      tx.registrationAgreement.findFirst({
        where: { enrollmentId, status: { not: RegistrationAgreementStatus.CANCELLED } },
        include: { document: { select: META_SELECT } },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }

  /** A single agreement by id, with its linked document meta. */
  agreementById(id: string) {
    return this.run((tx) =>
      tx.registrationAgreement.findFirst({
        where: { id },
        // Presence of a signed copy is signalled by signedFileName/signedFileKey — never load the
        // (potentially large) inline bytes here; stream them via signedBlob() when actually needed.
        omit: { signedFileData: true },
        include: { document: { select: META_SELECT } },
      }),
    );
  }

  /** The signed copy's storage reference + inline bytes + display metadata (for streaming it back). */
  signedBlob(id: string) {
    return this.run((tx) =>
      tx.registrationAgreement.findFirst({
        where: { id },
        select: {
          signedFileKey: true,
          signedFileData: true,
          signedFileName: true,
          signedFileType: true,
        },
      }),
    );
  }

  /**
   * Persist a registration agreement (the current version for a guardian+year): allocate the
   * agreement + document numbers, store the permanent snapshot + rendered PDF, and link them. When
   * `supersedesId` is set this is a new version — the prior agreement is archived in the same
   * transaction so it remains immutable history but is no longer the current one.
   */
  persistAgreement(input: {
    enrollmentId: string;
    studentId: string;
    parentId: string | null;
    academicYearId: string;
    campusId: string | null;
    gradeId: string | null;
    sectionId: string | null;
    registrationDate: Date;
    paymentMode: 'FULL' | 'INSTALLMENTS';
    installments: number;
    feeBreakdown: Prisma.InputJsonValue;
    installmentSchedule: Prisma.InputJsonValue;
    grandTotal: Prisma.Decimal;
    title: string;
    language: DocumentLanguage;
    dataSnapshot: Prisma.InputJsonValue;
    pdf: Buffer;
    checksum: string;
    byteSize: number;
    /** New version number (1 for the first agreement; N+1 when superseding). */
    version?: number;
    /** When set, this agreement supersedes an existing one (which is archived in the same tx). */
    supersedesId?: string | null;
  }) {
    return this.run(async (tx, tenantId) => {
      const agreementNo = await this.nextNumber(tx, tenantId, 'AGREEMENT');
      const version = input.version ?? 1;
      const document = await this.archiveInTx(tx, tenantId, {
        type: DocumentType.REGISTRATION_AGREEMENT,
        title: input.title,
        language: input.language,
        studentId: input.studentId,
        parentId: input.parentId,
        academicYearId: input.academicYearId,
        enrollmentId: input.enrollmentId,
        version,
        dataSnapshot: input.dataSnapshot,
        pdf: input.pdf,
        checksum: input.checksum,
        byteSize: input.byteSize,
      });

      // Superseding: archive the prior version so it stays as immutable history but is no longer the
      // current agreement for the parent+year.
      if (input.supersedesId) {
        await tx.registrationAgreement.update({
          where: { id: input.supersedesId },
          data: { status: RegistrationAgreementStatus.ARCHIVED },
        });
      }

      const agreement = await tx.registrationAgreement.create({
        data: {
          tenantId,
          agreementNo,
          version,
          status: RegistrationAgreementStatus.GENERATED,
          enrollmentId: input.enrollmentId,
          studentId: input.studentId,
          parentId: input.parentId,
          academicYearId: input.academicYearId,
          campusId: input.campusId,
          gradeId: input.gradeId,
          sectionId: input.sectionId,
          registrationDate: input.registrationDate,
          paymentMode: input.paymentMode,
          installments: input.installments,
          feeBreakdown: input.feeBreakdown,
          installmentSchedule: input.installmentSchedule,
          grandTotal: input.grandTotal,
          documentId: document.id,
          supersedesId: input.supersedesId ?? null,
          registrarId: this.actor(),
        },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'document.registrationAgreement.generate',
        entityType: 'RegistrationAgreement',
        entityId: agreement.id,
        metadata: { agreementNo, enrollmentId: input.enrollmentId, version },
      });
      return { agreement, document };
    });
  }

  /**
   * All of a guardian's COMMITTED enrollments for an academic year (with the immutable quote, grade
   * and section), so one registration agreement can cover every student under that guardian. Ordered
   * by creation so the students table is stable.
   */
  guardianEnrollments(parentId: string, academicYearId: string) {
    return this.run((tx) =>
      tx.enrollment.findMany({
        where: {
          academicYearId,
          admissionStatus: AdmissionStatus.REGISTERED,
          // Exclude soft-deleted students: a student removed after committing must not keep
          // appearing on the guardian's agreement (fee breakdown + installment schedule).
          student: { deletedAt: null, parentLinks: { some: { parentId } } },
        },
        orderBy: { createdAt: 'asc' },
        include: {
          quote: { include: { items: true } },
          academicYear: { select: { id: true, name: true, campusId: true } },
          grade: { select: { id: true, nameEn: true, nameAr: true } },
          student: {
            include: {
              section: { select: { id: true, name: true } },
              parentLinks: { include: { parent: true }, orderBy: { isPrimary: 'desc' } },
            },
          },
        },
      }),
    );
  }

  /**
   * The authoritative FAMILY installment schedule for a guardian+year, sourced from the persisted
   * FinancialAccountPlan and its aligned charge installments (grouped by due date), when the family was
   * admitted through the Family Admission workflow. Returns `hasPlan: false` for legacy student-billed
   * guardians (the agreement then falls back to merging the per-student quote schedules). Because every
   * child's plan is aligned to the family plan (same cadence + due dates), grouping by due date yields
   * exactly the family's N installments — never N per student.
   */
  async familyPlanSchedule(
    parentId: string,
    academicYearId: string,
  ): Promise<{ hasPlan: boolean; schedule: Array<{ dueDate: string | null; amount: string }> }> {
    return this.run(async (tx) => {
      const plan = await tx.financialAccountPlan.findFirst({
        where: { academicYearId, status: 'ACTIVE', payer: { parentId } },
        select: { id: true, payerId: true },
      });
      if (!plan) return { hasPlan: false, schedule: [] };

      // Every installment of a charge owned by a student billed through this financial account, for
      // this year. Includes the one-off registration-fee charge (due at registration) + the aligned
      // monthly installments. Grouped by due date → the account schedule.
      const installments = await tx.installment.findMany({
        where: {
          charge: {
            academicYearId,
            status: { notIn: ['CANCELLED', 'WRITTEN_OFF'] },
            account: { payerId: plan.payerId },
          },
          status: { notIn: ['CANCELLED', 'WAIVED'] },
        },
        select: { dueDate: true, amount: true },
      });
      const byDate = new Map<string, Prisma.Decimal>();
      for (const inst of installments) {
        const key = inst.dueDate ? inst.dueDate.toISOString().slice(0, 10) : '￿';
        byDate.set(key, (byDate.get(key) ?? new Prisma.Decimal(0)).plus(inst.amount));
      }
      const schedule = [...byDate.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([key, amount]) => ({
          dueDate: key === '￿' ? null : key,
          amount: amount.toFixed(3),
        }));
      return { hasPlan: true, schedule };
    });
  }

  /** The current (non-archived, non-cancelled) agreement for a parent+year — the highest version. */
  currentAgreementForParentYear(parentId: string, academicYearId: string) {
    return this.run((tx) =>
      tx.registrationAgreement.findFirst({
        where: {
          parentId,
          academicYearId,
          status: {
            notIn: [RegistrationAgreementStatus.ARCHIVED, RegistrationAgreementStatus.CANCELLED],
          },
        },
        include: { document: { select: META_SELECT } },
        orderBy: { version: 'desc' },
      }),
    );
  }

  /**
   * Effective lifecycle status shown in the UI: SIGNED once a countersigned copy is attached, else
   * PRINTED once the linked document has been printed (reusing the document's own print counter),
   * else GENERATED. CANCELLED/ARCHIVED (and legacy DRAFT/COMMITTED) pass through / map to GENERATED.
   */
  private effectiveAgreementStatus(a: {
    status: RegistrationAgreementStatus;
    signedFileKey: string | null;
    // signedFileName is set whenever a countersigned copy is attached (bucket OR inline), so it is a
    // cheap presence signal that avoids loading the (potentially large) inline bytes in list queries.
    signedFileName: string | null;
    document: { printedCount: number } | null;
  }): RegistrationAgreementStatus {
    if (
      a.status === RegistrationAgreementStatus.CANCELLED ||
      a.status === RegistrationAgreementStatus.ARCHIVED
    ) {
      return a.status;
    }
    if (a.signedFileKey || a.signedFileName) return RegistrationAgreementStatus.SIGNED;
    if ((a.document?.printedCount ?? 0) > 0) return RegistrationAgreementStatus.PRINTED;
    return RegistrationAgreementStatus.GENERATED;
  }

  /** Agreements for a student/enrollment, enriched with document print stats + signer/uploader. */
  async listAgreements(filter: { studentId?: string; enrollmentId?: string }) {
    return this.run(async (tx) => {
      const rows = await tx.registrationAgreement.findMany({
        where: {
          ...(filter.studentId ? { studentId: filter.studentId } : {}),
          ...(filter.enrollmentId ? { enrollmentId: filter.enrollmentId } : {}),
        },
        // Never pull the (potentially multi-MB) inline signed bytes into a list — presence is
        // signalled by signedFileName/signedFileKey; the bytes are streamed on demand.
        omit: { signedFileData: true },
        include: { document: { select: META_SELECT } },
        orderBy: [{ enrollmentId: 'asc' }, { createdAt: 'desc' }],
        take: 500,
      });
      const uploaderIds = [
        ...new Set(rows.map((r) => r.signedUploadedById).filter((v): v is string => Boolean(v))),
      ];
      const uploaders = uploaderIds.length
        ? await tx.user.findMany({
            where: { id: { in: uploaderIds } },
            select: { id: true, firstNameEn: true, lastNameEn: true, email: true },
          })
        : [];
      const nameOf = (id: string | null): string | null => {
        if (!id) return null;
        const u = uploaders.find((x) => x.id === id);
        if (!u) return null;
        return [u.firstNameEn, u.lastNameEn].filter(Boolean).join(' ').trim() || u.email;
      };
      return rows.map((r) => ({
        id: r.id,
        agreementNo: r.agreementNo,
        version: r.version,
        status: r.status,
        effectiveStatus: this.effectiveAgreementStatus(r),
        enrollmentId: r.enrollmentId,
        studentId: r.studentId,
        grandTotal: r.grandTotal.toFixed(3),
        documentId: r.documentId,
        registrationDate: r.registrationDate,
        createdAt: r.createdAt,
        printedCount: r.document?.printedCount ?? 0,
        lastPrintedAt: r.document?.lastPrintedAt ?? null,
        signedFileName: r.signedFileName,
        signedFileType: r.signedFileType,
        signedAt: r.signedAt,
        signedBy: r.signedBy,
        signedUploadedAt: r.signedUploadedAt,
        signedUploadedByName: nameOf(r.signedUploadedById),
        hasSigned: Boolean(r.signedFileKey || r.signedFileName),
      }));
    });
  }

  /** Attach (or replace) the parent's countersigned copy. Stores only a storage-key reference. */
  attachSignedAgreement(input: {
    agreementId: string;
    // Exactly one of fileKey (bucket) / fileData (inline) is set; the other is cleared.
    fileKey: string | null;
    fileData: Uint8Array<ArrayBuffer> | null;
    fileName: string;
    contentType: string;
    size: number | null;
    signedBy: string | null;
    signedAt: Date | null;
    mode: 'upload' | 'replace';
    ctx?: AccessContext;
  }): Promise<{ signedFileKey: string | null; priorKey: string | null }> {
    return this.run(async (tx, tenantId) => {
      const existing = await tx.registrationAgreement.findFirst({
        where: { id: input.agreementId },
      });
      if (!existing) throw new NotFoundException('Registration agreement not found');
      const priorKey = existing.signedFileKey;
      await tx.registrationAgreement.update({
        where: { id: input.agreementId },
        data: {
          signedFileKey: input.fileKey,
          signedFileData: input.fileData,
          signedFileName: input.fileName,
          signedFileType: input.contentType,
          signedFileSize: input.size,
          signedBy: input.signedBy,
          signedAt: input.signedAt ?? new Date(),
          signedUploadedById: this.actor(),
          signedUploadedAt: new Date(),
          status: RegistrationAgreementStatus.SIGNED,
        },
      });
      await this.writeAudit(tx, tenantId, {
        action:
          input.mode === 'replace'
            ? 'document.registrationAgreement.signReplace'
            : 'document.registrationAgreement.signUpload',
        entityType: 'RegistrationAgreement',
        entityId: input.agreementId,
        metadata: {
          fileName: input.fileName,
          contentType: input.contentType,
          ...(input.ctx?.ip ? { ip: input.ctx.ip } : {}),
          ...(input.ctx?.userAgent ? { userAgent: input.ctx.userAgent } : {}),
        },
      });
      return { signedFileKey: input.fileKey, priorKey };
    });
  }

  /** Remove the signed copy reference (the object itself is deleted by the service). Audited. */
  clearSignedAgreement(id: string, ctx?: AccessContext): Promise<{ priorKey: string | null }> {
    return this.run(async (tx, tenantId) => {
      const existing = await tx.registrationAgreement.findFirst({ where: { id } });
      if (!existing) throw new NotFoundException('Registration agreement not found');
      const priorKey = existing.signedFileKey;
      await tx.registrationAgreement.update({
        where: { id },
        data: {
          signedFileKey: null,
          signedFileData: null,
          signedFileName: null,
          signedFileType: null,
          signedFileSize: null,
          signedBy: null,
          signedAt: null,
          signedUploadedById: null,
          signedUploadedAt: null,
          status: RegistrationAgreementStatus.GENERATED,
        },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'document.registrationAgreement.signDelete',
        entityType: 'RegistrationAgreement',
        entityId: id,
        metadata: {
          priorFileName: existing.signedFileName,
          ...(ctx?.ip ? { ip: ctx.ip } : {}),
          ...(ctx?.userAgent ? { userAgent: ctx.userAgent } : {}),
        },
      });
      return { priorKey };
    });
  }

  /** Audit a VIEW of the signed copy (a presigned download URL was issued). */
  auditSignedView(id: string, ctx?: AccessContext): Promise<unknown> {
    return this.run((tx, tenantId) =>
      this.writeAudit(tx, tenantId, {
        action: 'document.registrationAgreement.signView',
        entityType: 'RegistrationAgreement',
        entityId: id,
        metadata: {
          ...(ctx?.ip ? { ip: ctx.ip } : {}),
          ...(ctx?.userAgent ? { userAgent: ctx.userAgent } : {}),
        },
      }),
    );
  }

  // ── Context reads (data the templates render) ──────────────────────────────

  /** Enrollment + quote + people/placement for building an agreement snapshot. */
  enrollmentContext(enrollmentId: string) {
    return this.run(async (tx) => {
      const enrollment = await tx.enrollment.findFirst({
        where: { id: enrollmentId },
        include: {
          quote: { include: { items: true } },
          academicYear: { select: { id: true, name: true, campusId: true } },
          grade: { select: { id: true, nameEn: true, nameAr: true } },
          student: {
            include: {
              section: { select: { id: true, name: true } },
              parentLinks: { include: { parent: true }, orderBy: { isPrimary: 'desc' } },
            },
          },
        },
      });
      return enrollment;
    });
  }

  /** A student's identity + primary guardian + current enrollment (for finance documents). */
  studentContext(studentId: string) {
    return this.run(async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId, deletedAt: null },
        include: {
          section: { include: { grade: { select: { nameEn: true, nameAr: true } } } },
          parentLinks: { include: { parent: true }, orderBy: { isPrimary: 'desc' } },
          enrollments: {
            orderBy: { createdAt: 'desc' },
            include: { academicYear: { select: { id: true, name: true } } },
          },
        },
      });
      return student;
    });
  }

  /** A verified payment with its allocations (→ installment → charge) for the receipt. */
  paymentContext(paymentId: string) {
    return this.run((tx) =>
      tx.payment.findFirst({
        where: { id: paymentId },
        include: {
          allocations: {
            include: { installment: { include: { charge: { select: { description: true } } } } },
          },
          student: {
            include: { parentLinks: { include: { parent: true }, orderBy: { isPrimary: 'desc' } } },
          },
        },
      }),
    );
  }

  academicYears() {
    return this.run((tx) =>
      tx.academicYear.findMany({
        select: { id: true, name: true, isCurrent: true },
        orderBy: { startDate: 'desc' },
      }),
    );
  }

  /** The student's enrollment for a given academic year, with its immutable fee quote. */
  yearEnrollment(studentId: string, academicYearId: string) {
    return this.run((tx) =>
      tx.enrollment.findFirst({
        where: { studentId, academicYearId },
        include: { quote: { include: { items: true } }, academicYear: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  /**
   * The whole amount the student actually PAID within a calendar year (1 Jan … 31 Dec) — the sum of
   * every verified payment received in that window, regardless of which charge/category it settled.
   * This is the figure the Annual Tuition Certificate certifies (used for annual/tax purposes). A
   * payment's date is its verification date, falling back to when it was recorded.
   */
  async paidInCalendarYear(studentId: string, year: number): Promise<string> {
    return this.run(async (tx) => {
      const start = new Date(Date.UTC(year, 0, 1));
      const end = new Date(Date.UTC(year + 1, 0, 1));
      const agg = await tx.payment.aggregate({
        where: {
          studentId,
          status: PaymentStatus.VERIFIED,
          OR: [
            { verifiedAt: { gte: start, lt: end } },
            { verifiedAt: null, createdAt: { gte: start, lt: end } },
          ],
        },
        _sum: { amount: true },
      });
      return (agg._sum.amount ?? new Prisma.Decimal(0)).toFixed(3);
    });
  }

  /** Sum of verified payments allocated to the installments of an enrollment's charges (paid/year). */
  async paidForEnrollment(enrollmentId: string): Promise<string> {
    return this.run(async (tx) => {
      const agg = await tx.paymentAllocation.aggregate({
        where: { reversedAt: null, installment: { charge: { enrollmentId } } },
        _sum: { amount: true },
      });
      return (agg._sum.amount ?? new Prisma.Decimal(0)).toFixed(3);
    });
  }

  /** Resolve a student's parent emails by role for document email delivery. */
  async recipientEmails(
    studentId: string,
  ): Promise<{ primary: string | null; secondary: string | null; guardian: string | null }> {
    return this.run(async (tx) => {
      const links = await tx.parentStudent.findMany({
        where: { studentId },
        include: { parent: { select: { email: true } } },
        orderBy: { isPrimary: 'desc' },
      });
      const withEmail = links.filter((l) => l.parent.email);
      const guardianLink = withEmail.find((l) => l.relation === 'GUARDIAN');
      return {
        primary: withEmail[0]?.parent.email ?? null,
        secondary: withEmail[1]?.parent.email ?? null,
        guardian: guardianLink?.parent.email ?? null,
      };
    });
  }

  /** Display name (or email) of a user — used for the cashier/registrar line on documents. */
  async userName(userId: string | null): Promise<string | null> {
    if (!userId) return null;
    return this.run(async (tx) => {
      const u = await tx.user.findFirst({
        where: { id: userId },
        select: { firstNameEn: true, lastNameEn: true, email: true },
      });
      if (!u) return null;
      const name = [u.firstNameEn, u.lastNameEn].filter(Boolean).join(' ').trim();
      return name || u.email;
    });
  }
}
