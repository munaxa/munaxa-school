import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AdmissionStatus,
  DocumentLanguage,
  FeeItemKind,
  Prisma,
  QuotePaymentMode,
} from '@prisma/client';
import { DocumentEngineService } from './document-engine.service';
import { DocumentRepository } from './document.repository';
import {
  buildAgreementLayout,
  DEFAULT_AGREEMENT_LEGAL_CLAUSES_AR,
  DEFAULT_AGREEMENT_LEGAL_CLAUSES_EN,
  type AgreementSnapshot,
} from './templates/agreement-template';
import { fullNameAr, fullNameEn } from './templates/util';
import { splitFils, toFils } from '../finance/shared/money';
import { StorageService, type PresignedUpload } from '../common/storage.service';
import { requireTenantId } from '../common/tenant.util';
import type { AccessContext } from './document.types';
import type { ConfirmSignedAgreementDto, PresignSignedAgreementDto } from './documents.dto';

/** The signed countersigned copy may only be a PDF or a photo of the paper agreement (JPG/PNG). */
const SIGNED_UPLOAD_MIME: ReadonlySet<string> = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

/** Hard ceiling for a countersigned copy (matches the presign DTO limit). */
const MAX_SIGNED_BYTES = 15 * 1024 * 1024;

function addMonths(base: Date, n: number): Date {
  const dt = new Date(base);
  const day = dt.getDate();
  dt.setDate(1);
  dt.setMonth(dt.getMonth() + n);
  const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  dt.setDate(Math.min(day, last));
  return dt;
}

/** One committed enrolment with the quote/grade/section/parent includes the snapshot needs. */
type SourceEnrollment = Awaited<ReturnType<DocumentRepository['guardianEnrollments']>>[number];
type SourceParent = SourceEnrollment['student']['parentLinks'][number]['parent'] | null;

/**
 * A stable content signature of the agreement's material data (student identities + fees + the merged
 * schedule + grand total), independent of key order or language-specific labels. Two generations with
 * the same signature are the same agreement (idempotent); a different signature means the guardian's
 * enrolments/fees changed and the agreement must be superseded.
 */
function agreementFingerprint(
  students: AgreementSnapshot['students'],
  schedule: AgreementSnapshot['schedule'],
  grandTotal: string,
): string {
  const s = students
    .map((x) => [x.nameEn, x.tuition, x.transportation, x.discount, x.net].join('|'))
    .sort()
    .join(';');
  const p = schedule.map((x) => [x.dueDate ?? '', x.amount].join('|')).join(';');
  return `${s}#${p}#${grandTotal}`;
}

/**
 * Registration Agreement generator. The registration agreement IS the parent's financial commitment:
 * it builds a permanent snapshot covering ALL of a guardian's committed students for the academic year
 * (each with its own fees), renders the legal PDF, and stores ONE current agreement per guardian+year.
 * Called automatically right after a successful commit (and on approval of a held enrollment).
 * Generation is **idempotent** on content: re-running with the same students/fees returns the current
 * agreement unchanged; when the guardian's enrolments or fees have changed (e.g. a second child
 * enrols), a NEW version is generated that supersedes the prior one — the superseded agreement is
 * archived as immutable history, never mutated in place. It also manages the parent's countersigned
 * copy (upload / replace / view / delete), stored in object storage and referenced by key.
 */
@Injectable()
export class RegistrationAgreementService {
  private readonly logger = new Logger(RegistrationAgreementService.name);

  constructor(
    private readonly engine: DocumentEngineService,
    private readonly repo: DocumentRepository,
    private readonly storage: StorageService,
  ) {}

  /**
   * Best-effort auto-generation hook used by Admissions after commit/approval. Only generates for a
   * COMMITTED enrollment, and never throws into the caller — a registration must succeed even if the
   * (regenerable-from-snapshot) document could not be produced.
   */
  async tryAutoGenerate(enrollmentId: string): Promise<void> {
    try {
      const enrollment = await this.repo.enrollmentContext(enrollmentId);
      if (!enrollment || enrollment.admissionStatus !== AdmissionStatus.REGISTERED) return;
      // Registration agreements are legal records for an Arabic-and-English audience, so they are
      // rendered bilingually (Arabic + English) by default.
      await this.generate(enrollmentId, DocumentLanguage.BILINGUAL);
    } catch (err) {
      this.logger.error(`auto-generation of registration agreement failed: ${String(err)}`);
    }
  }

  /**
   * Generate the registration agreement (the parent's financial commitment). One agreement per
   * guardian + academic year, covering ALL that guardian's committed students. Idempotent: if the
   * current agreement already reflects the same students/fees it is returned unchanged. When the
   * guardian's enrolments or fees have changed since (e.g. a second child enrols), a NEW version is
   * generated that supersedes the prior one (which is archived as history) — signed legal records are
   * never mutated in place.
   */
  async generate(enrollmentId: string, language: DocumentLanguage) {
    const enrollment = await this.repo.enrollmentContext(enrollmentId);
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    if (!enrollment.quote) throw new NotFoundException('Enrollment has no quote to snapshot');

    const parent = enrollment.student.parentLinks[0]?.parent ?? null;
    const academicYearId = enrollment.academicYearId;

    // The agreement covers every one of the guardian's committed students for the year; fall back to
    // just the triggering enrolment when the student has no linked guardian.
    const guardianEnrollments = parent
      ? (await this.repo.guardianEnrollments(parent.id, academicYearId)).filter((e) => e.quote)
      : [];
    const sources = guardianEnrollments.length > 0 ? guardianEnrollments : [enrollment];

    // Prefer the authoritative FAMILY payment plan schedule (Family Admission) over merging the
    // per-student quote schedules; the merge remains the fallback for legacy student-billed guardians.
    const familyPlan = parent
      ? await this.repo.familyPlanSchedule(parent.id, academicYearId)
      : { hasPlan: false, schedule: [] };

    const snapshot = this.buildSnapshot(sources, parent, enrollment, language);
    if (familyPlan.hasPlan) {
      snapshot.schedule = familyPlan.schedule.map((row, i) => ({
        index: i + 1,
        dueDate: row.dueDate,
        amount: row.amount,
      }));
    }
    const fingerprint = agreementFingerprint(
      snapshot.students,
      snapshot.schedule,
      snapshot.grandTotal,
    );

    // One current agreement per parent+year: reuse it unchanged, else supersede it with a new version.
    const current = parent
      ? await this.repo.currentAgreementForParentYear(parent.id, academicYearId)
      : await this.repo.agreementByEnrollment(enrollmentId);
    if (current) {
      const currentFingerprint = agreementFingerprint(
        (current.feeBreakdown ?? []) as unknown as AgreementSnapshot['students'],
        (current.installmentSchedule ?? []) as unknown as AgreementSnapshot['schedule'],
        current.grandTotal.toFixed(3),
      );
      // Reuse the current agreement only when BOTH the material data AND the rendering language are
      // unchanged; a different language (e.g. regenerating an English agreement as bilingual) still
      // produces a new version so the requested language actually takes effect.
      if (currentFingerprint === fingerprint && current.document?.language === language) {
        const { document, ...agreement } = current;
        return { agreement, document };
      }
    }

    const branding = await this.engine.resolveBranding();
    const layout = buildAgreementLayout(snapshot, language);
    const rendered = await this.engine.render(layout, branding);

    return this.repo.persistAgreement({
      enrollmentId, // the triggering enrolment is the record's primary reference
      studentId: enrollment.studentId,
      parentId: parent?.id ?? null,
      academicYearId,
      campusId: enrollment.academicYear?.campusId ?? null,
      gradeId: enrollment.gradeId,
      sectionId: enrollment.student.section?.id ?? null,
      registrationDate: enrollment.createdAt,
      paymentMode: enrollment.paymentMode,
      installments: enrollment.paymentMode === QuotePaymentMode.FULL ? 1 : snapshot.schedule.length,
      feeBreakdown: snapshot.students as unknown as Prisma.InputJsonValue,
      installmentSchedule: snapshot.schedule as unknown as Prisma.InputJsonValue,
      grandTotal: new Prisma.Decimal(snapshot.grandTotal),
      title: layout.title,
      language,
      dataSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      pdf: rendered.buffer,
      checksum: rendered.checksum,
      byteSize: rendered.byteSize,
      version: current ? current.version + 1 : 1,
      supersedesId: current ? current.id : null,
    });
  }

  /**
   * Build the parent-primary snapshot from every one of the guardian's committed enrolments. Each
   * enrolment becomes one Students & Fees row (its quote folded into the fixed tuition/transport/
   * discount/net columns); the family payment schedule is the enrolments' installments merged by due
   * date. `triggering` supplies the header identity (academic year, registration date).
   */
  private buildSnapshot(
    enrollments: SourceEnrollment[],
    parent: SourceParent,
    triggering: SourceEnrollment,
    language: DocumentLanguage,
  ): AgreementSnapshot {
    const students: AgreementSnapshot['students'] = enrollments.map((e) => {
      const quote = e.quote!;
      // TRANSPORT items become the transport fee, everything else is tuition/charges; discount is the
      // summed discount; net is the amount payable after discount. (tuition + transport − discount).
      let transport = new Prisma.Decimal(0);
      let tuition = new Prisma.Decimal(0);
      let discount = new Prisma.Decimal(0);
      for (const it of quote.items) {
        if (it.kind === FeeItemKind.TRANSPORT) transport = transport.plus(it.amount);
        else tuition = tuition.plus(it.amount);
        discount = discount.plus(it.discountAmount);
      }
      return {
        nameEn: fullNameEn(e.student),
        nameAr: fullNameAr(e.student),
        studentNumber: e.student.nationalId ?? '',
        gradeName:
          language === DocumentLanguage.AR ? (e.grade?.nameAr ?? '—') : (e.grade?.nameEn ?? '—'),
        sectionName: e.student.section?.name ?? null,
        tuition: tuition.toFixed(3),
        transportation: transport.toFixed(3),
        discount: discount.toFixed(3),
        net: quote.grandTotal.toFixed(3),
      };
    });
    const grandTotal = students.reduce((a, s) => a + Number(s.net), 0).toFixed(3);

    return {
      agreementNo: 0, // assigned at persist time
      version: 0, // assigned at persist time
      academicYearName: triggering.academicYear?.name ?? '—',
      registrationDate: this.iso(triggering.createdAt) ?? '',
      parentNameEn: parent ? fullNameEn(parent) : '—',
      parentNameAr: parent ? fullNameAr(parent) : null,
      parentNationalId: parent?.nationalId ?? null,
      parentPhone: parent?.phone ?? null,
      parentAddress: null,
      students,
      grandTotal,
      schedule: this.combineSchedules(enrollments),
      legalClausesEn: DEFAULT_AGREEMENT_LEGAL_CLAUSES_EN,
      legalClausesAr: DEFAULT_AGREEMENT_LEGAL_CLAUSES_AR,
      registrarName: null,
    };
  }

  /** The family payment schedule: each enrolment's installments merged by due date, then re-indexed. */
  private combineSchedules(enrollments: SourceEnrollment[]): AgreementSnapshot['schedule'] {
    const byDate = new Map<string, number>();
    for (const e of enrollments) {
      for (const { dueDate, fils } of this.installmentFils(e)) {
        const key = dueDate ?? '￿'; // undated installments sort last
        byDate.set(key, (byDate.get(key) ?? 0) + fils);
      }
    }
    return [...byDate.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([key, fils], i) => ({
        index: i + 1,
        dueDate: key === '￿' ? null : key,
        amount: (fils / 1000).toFixed(3),
      }));
  }

  /**
   * One enrolment's installments in fils, deterministically reproduced from the immutable quote (same
   * algorithm AdmissionsRepository.createEnrollmentCharges used), so the snapshot is permanent. In
   * INSTALLMENTS mode, when the registration fee was paid at registration it is a single line due at
   * registration (never divided across the monthly plan) and only the remaining net is split into the
   * N installments; when it was NOT paid up front it stays folded into the amount that is split.
   */
  private installmentFils(e: SourceEnrollment): Array<{ dueDate: string | null; fils: number }> {
    const quote = e.quote!;
    const totalFils = toFils(quote.grandTotal.toFixed(3));
    if (quote.paymentMode === QuotePaymentMode.FULL) {
      return [{ dueDate: this.iso(quote.firstDueDate), fils: totalFils }];
    }
    const registrationFils = e.registrationFeePaid
      ? quote.items
          .filter((it) => it.kind === FeeItemKind.REGISTRATION)
          .reduce((sum, it) => sum + toFils(it.amount.minus(it.discountAmount).toFixed(3)), 0)
      : 0;
    const remainderFils = totalFils - registrationFils;
    const base = quote.firstDueDate ?? e.createdAt;
    const lines: Array<{ dueDate: string | null; fils: number }> = [];
    // Registration fee first — a one-off payment due at registration, not part of the monthly split.
    if (registrationFils > 0) {
      lines.push({ dueDate: this.iso(e.createdAt), fils: registrationFils });
    }
    if (remainderFils > 0) {
      for (const [i, fils] of splitFils(remainderFils, quote.installments).entries()) {
        lines.push({ dueDate: this.iso(addMonths(base, i)), fils });
      }
    }
    return lines;
  }

  private iso(d: Date | null | undefined): string | null {
    return d ? new Date(d).toISOString().slice(0, 10) : null;
  }

  // ── Signed (countersigned) copy ────────────────────────────────────────────

  private assertSignedType(contentType: string): void {
    const type = (contentType ?? '').split(';')[0]!.trim().toLowerCase();
    if (!SIGNED_UPLOAD_MIME.has(type)) {
      throw new BadRequestException('Signed agreement must be a PDF, JPG or PNG file');
    }
  }

  /** Pre-sign a direct-to-bucket upload for the parent's countersigned copy (PDF/JPG/PNG only). */
  async presignSigned(
    agreementId: string,
    dto: PresignSignedAgreementDto,
  ): Promise<PresignedUpload> {
    this.assertSignedType(dto.contentType);
    const agreement = await this.repo.agreementById(agreementId);
    if (!agreement) throw new NotFoundException('Registration agreement not found');
    const key = this.storage.buildKey(requireTenantId(), 'agreements-signed', dto.fileName);
    return this.storage.presignUpload(key, dto.contentType, dto.size);
  }

  /**
   * Confirm an uploaded signed copy. `mode` distinguishes the first upload (DOCUMENT_UPLOAD_SIGNED)
   * from a replacement (DOCUMENT_REPLACE_SIGNED, enforced by the controller). A first upload over an
   * already-signed agreement is rejected — the caller must use the replace endpoint. On replace, the
   * previously stored object is deleted so the bucket never keeps an orphaned copy.
   */
  async confirmSigned(
    agreementId: string,
    dto: ConfirmSignedAgreementDto,
    mode: 'upload' | 'replace',
    ctx?: AccessContext,
  ) {
    this.assertSignedType(dto.contentType);
    const agreement = await this.repo.agreementById(agreementId);
    if (!agreement) throw new NotFoundException('Registration agreement not found');
    if (mode === 'upload' && (agreement.signedFileKey || agreement.signedFileName)) {
      throw new ConflictException(
        'A signed agreement already exists — use replace to overwrite it',
      );
    }

    // Resolve where the bytes live. The default (API-proxied) path sends the file base64-encoded and
    // the server stores it — to the bucket when S3 is configured, otherwise inline on the row. The
    // legacy path echoes a presigned `fileKey`. This removes the browser→bucket PUT that failed with
    // "failed to fetch" when storage was unconfigured (a stub host) or the bucket lacked CORS.
    let fileKey: string | null = null;
    let fileData: Uint8Array<ArrayBuffer> | null = null;
    let size = dto.size ?? null;

    if (dto.fileData) {
      const buffer = Buffer.from(dto.fileData, 'base64');
      if (buffer.length === 0) throw new BadRequestException('Uploaded file is empty');
      if (buffer.length > MAX_SIGNED_BYTES) {
        throw new BadRequestException('Signed agreement exceeds the maximum allowed size (15 MB)');
      }
      size = buffer.length;
      if (this.storage.configured) {
        const key = this.storage.buildKey(requireTenantId(), 'agreements-signed', dto.fileName);
        await this.storage.putObject(key, buffer, dto.contentType);
        fileKey = key;
      } else {
        // Fresh ArrayBuffer-backed copy so the type matches Prisma's Bytes input exactly.
        fileData = Uint8Array.from(buffer);
      }
    } else if (dto.fileKey) {
      this.storage.assertKeyInTenant(dto.fileKey);
      fileKey = dto.fileKey;
    } else {
      throw new BadRequestException('No file provided (fileData or fileKey is required)');
    }

    const priorKey = agreement.signedFileKey;
    await this.repo.attachSignedAgreement({
      agreementId,
      fileKey,
      fileData,
      fileName: dto.fileName,
      contentType: dto.contentType,
      size,
      signedBy: dto.signedBy ?? null,
      signedAt: dto.signedAt ? new Date(dto.signedAt) : null,
      mode,
      ...(ctx ? { ctx } : {}),
    });
    // Remove the previously stored bucket object (if any) so no orphaned copy remains.
    if (priorKey && priorKey !== fileKey) {
      await this.storage.deleteObject(priorKey).catch((err) => {
        this.logger.error(`failed to delete superseded signed copy: ${String(err)}`);
      });
    }
    return { signed: true };
  }

  /**
   * Stream the signed copy's bytes back through the API (same-origin, audited as a VIEW). Serves the
   * inline fallback bytes directly, or fetches the object from the bucket server-side — so viewing
   * works whether or not object storage is configured, and never depends on browser→bucket CORS.
   */
  async streamSigned(
    agreementId: string,
    ctx?: AccessContext,
  ): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
    const blob = await this.repo.signedBlob(agreementId);
    if (!blob || (!blob.signedFileKey && !blob.signedFileData)) {
      throw new NotFoundException('No signed agreement has been uploaded');
    }
    let buffer: Buffer;
    if (blob.signedFileData) {
      buffer = Buffer.from(blob.signedFileData);
    } else {
      this.storage.assertKeyInTenant(blob.signedFileKey!);
      buffer = await this.storage.getObject(blob.signedFileKey!);
    }
    await this.repo.auditSignedView(agreementId, ctx);
    return {
      buffer,
      contentType: blob.signedFileType ?? 'application/octet-stream',
      fileName: blob.signedFileName ?? 'signed-agreement',
    };
  }

  /** Issue a short-lived presigned download URL for the signed copy (audited as a VIEW). */
  async viewSigned(agreementId: string, ctx?: AccessContext): Promise<{ url: string }> {
    const agreement = await this.repo.agreementById(agreementId);
    if (!agreement) throw new NotFoundException('Registration agreement not found');
    if (!agreement.signedFileKey) {
      throw new NotFoundException('No signed agreement has been uploaded');
    }
    this.storage.assertKeyInTenant(agreement.signedFileKey);
    const url = await this.storage.presignDownload(agreement.signedFileKey);
    await this.repo.auditSignedView(agreementId, ctx);
    return { url };
  }

  /** Delete the uploaded signed copy (reference + stored object). Audited. */
  async deleteSigned(agreementId: string, ctx?: AccessContext): Promise<{ deleted: boolean }> {
    const agreement = await this.repo.agreementById(agreementId);
    if (!agreement) throw new NotFoundException('Registration agreement not found');
    if (!agreement.signedFileKey && !agreement.signedFileName) {
      throw new NotFoundException('No signed agreement has been uploaded');
    }
    const { priorKey } = await this.repo.clearSignedAgreement(agreementId, ctx);
    if (priorKey) {
      await this.storage.deleteObject(priorKey).catch((err) => {
        this.logger.error(`failed to delete signed copy object: ${String(err)}`);
      });
    }
    return { deleted: true };
  }
}
