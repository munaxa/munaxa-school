import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DocumentAccessAction,
  DocumentAccessStatus,
  DocumentLanguage,
  DocumentType,
} from '@prisma/client';
import type { Env } from '../config/env.validation';
import { MailService } from '../mail/mail.service';
import { DocumentRepository, type DocumentMeta } from './document.repository';
import { FinanceDocumentsService } from './finance-documents.service';
import { RegistrationAgreementService } from './registration-agreement.service';
import { DocumentEngineService } from './document-engine.service';
import type { AccessContext, DocumentParams } from './document.types';
import type {
  ConfirmSignedAgreementDto,
  EmailDocumentDto,
  GenerateAgreementDto,
  GenerateDocumentDto,
  PresignSignedAgreementDto,
} from './documents.dto';
import { docNumber } from './templates/util';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Document Engine orchestrator (Phase 23 + 23b). Single entry point for the API/UI. Applies the
 * persistence strategy: SNAPSHOT documents are served from the stored PDF; DYNAMIC documents are
 * re-rendered from the live ledger on every print/download/email and discarded. Every action is
 * recorded in DocumentAccessLog + the audit log.
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly repo: DocumentRepository,
    private readonly finance: FinanceDocumentsService,
    private readonly agreements: RegistrationAgreementService,
    private readonly engine: DocumentEngineService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Generate (and persist per strategy) a finance document. Registration agreements use their own
   * idempotent flow (POST /documents/agreements) — one immutable agreement per enrollment. */
  async generate(dto: GenerateDocumentDto): Promise<DocumentMeta> {
    if (dto.type === DocumentType.REGISTRATION_AGREEMENT) {
      throw new BadRequestException(
        'Use POST /documents/agreements to (re)generate a registration agreement',
      );
    }
    const params: DocumentParams = {
      type: dto.type,
      language: dto.language ?? DocumentLanguage.EN,
      ...(dto.studentId ? { studentId: dto.studentId } : {}),
      ...(dto.paymentId ? { paymentId: dto.paymentId } : {}),
      ...(dto.academicYearId ? { academicYearId: dto.academicYearId } : {}),
      ...(dto.year ? { year: dto.year } : {}),
    };
    const built = await this.finance.build(params);
    return this.engine.persist(built, params);
  }

  async generateAgreement(dto: GenerateAgreementDto) {
    return this.agreements.generate(dto.enrollmentId, dto.language ?? DocumentLanguage.EN);
  }

  list(filter: { studentId?: string; type?: DocumentType; enrollmentId?: string }) {
    return this.repo.listDocuments(filter);
  }

  async getMeta(id: string): Promise<DocumentMeta> {
    const meta = await this.repo.getMeta(id);
    if (!meta) throw new NotFoundException('Document not found');
    return meta;
  }

  listAgreements(filter: { studentId?: string; enrollmentId?: string }) {
    return this.repo.listAgreements(filter);
  }

  // ── Signed (countersigned) registration agreement ──────────────────────────

  presignSignedAgreement(agreementId: string, dto: PresignSignedAgreementDto) {
    return this.agreements.presignSigned(agreementId, dto);
  }

  confirmSignedAgreement(
    agreementId: string,
    dto: ConfirmSignedAgreementDto,
    mode: 'upload' | 'replace',
    ctx?: AccessContext,
  ) {
    return this.agreements.confirmSigned(agreementId, dto, mode, ctx);
  }

  viewSignedAgreement(agreementId: string, ctx?: AccessContext) {
    return this.agreements.viewSigned(agreementId, ctx);
  }

  /** Stream the signed copy's bytes back through the API (works with or without object storage). */
  streamSignedAgreement(agreementId: string, ctx?: AccessContext) {
    return this.agreements.streamSigned(agreementId, ctx);
  }

  deleteSignedAgreement(agreementId: string, ctx?: AccessContext) {
    return this.agreements.deleteSigned(agreementId, ctx);
  }

  academicYears() {
    return this.repo.academicYears();
  }

  accessHistory(id: string) {
    return this.repo.accessHistory(id);
  }

  /** Produce the PDF for a document WITHOUT recording an access action. SNAPSHOT → stored bytes;
   * DYNAMIC → re-render from live data using the stored params. */
  private async produce(id: string): Promise<{ meta: DocumentMeta; pdf: Buffer }> {
    const { meta, persistence, pdf, params } = await this.repo.documentForServe(id);
    if (persistence === 'SNAPSHOT') {
      if (!pdf) throw new NotFoundException('Stored document PDF is missing');
      return { meta, pdf };
    }
    // DYNAMIC: rebuild from the live ledger using the persisted params.
    if (!params) throw new BadRequestException('Document cannot be regenerated (missing params)');
    const built = await this.finance.build(params as DocumentParams);
    const rendered = await this.engine.renderBuilt(built);
    return { meta, pdf: rendered.buffer };
  }

  async download(id: string, ctx?: AccessContext): Promise<{ meta: DocumentMeta; pdf: Buffer }> {
    const out = await this.produce(id);
    await this.repo.recordAccess(id, DocumentAccessAction.DOWNLOAD, ctx);
    return out;
  }

  async print(id: string, ctx?: AccessContext): Promise<{ meta: DocumentMeta; pdf: Buffer }> {
    const out = await this.produce(id);
    await this.repo.recordAccess(id, DocumentAccessAction.PRINT, ctx);
    return out;
  }

  /**
   * Email a document. Recipients are resolved from the requested parent roles (primary parent by
   * default) plus any explicit custom addresses. SNAPSHOT docs attach the stored PDF; DYNAMIC docs
   * are rendered immediately before sending and the attachment is never archived.
   */
  async email(id: string, dto: EmailDocumentDto, ctx?: AccessContext): Promise<{ sent: boolean }> {
    const { meta, pdf } = await this.produce(id);
    const { to, cc, bcc } = await this.resolveRecipients(meta, dto);
    if (to.length === 0) {
      throw new BadRequestException('No recipient email available (no parent email on file)');
    }

    const filename = `${meta.type.toLowerCase()}-${docNumber('DOC', meta.documentNo)}.pdf`;
    const subject = dto.subject?.trim() || meta.title;
    const html =
      `<p>Dear parent,</p><p>Please find attached your document: <strong>${meta.title}</strong>.</p>` +
      `${dto.message ? `<p>${this.escapeHtml(dto.message)}</p>` : ''}<p>Thank you.</p>`;
    const from = this.config.get('EMAIL_FROM_FINANCE', { infer: true });

    let sent = false;
    let providerError: string | null = null;
    try {
      const res = await this.mail.send({
        to,
        subject,
        html,
        ...(from ? { from } : {}),
        ...(dto.replyTo ? { replyTo: dto.replyTo } : {}),
        ...(cc.length > 0 ? { cc } : {}),
        ...(bcc.length > 0 ? { bcc } : {}),
        attachments: [{ filename, content: pdf }],
      });
      sent = res.sent;
    } catch (err) {
      providerError = err instanceof Error ? err.message : 'send failed';
    }

    const status = sent ? DocumentAccessStatus.SUCCESS : DocumentAccessStatus.FAILED;
    await this.repo.logDocumentEmail({
      documentId: id,
      recipients: to,
      cc,
      bcc,
      subject,
      providerResponse: providerError,
      status,
    });
    await this.repo.recordAccess(id, DocumentAccessAction.EMAIL, ctx, status);

    if (!sent) {
      throw new ServiceUnavailableException(
        providerError ?? 'Email could not be sent (mail service unavailable)',
      );
    }
    return { sent };
  }

  /** Resolve the final recipient/cc/bcc lists from requested parent roles + explicit addresses. */
  private async resolveRecipients(
    meta: DocumentMeta,
    dto: EmailDocumentDto,
  ): Promise<{ to: string[]; cc: string[]; bcc: string[] }> {
    // Primary parent is the default recipient unless the caller specified another recipient.
    const otherSpecified =
      (dto.to?.length ?? 0) > 0 ||
      Boolean(dto.includeSecondaryParent) ||
      Boolean(dto.includeGuardian);
    const includePrimary = dto.includePrimaryParent ?? !otherSpecified;

    const needRoles = includePrimary || dto.includeSecondaryParent || dto.includeGuardian;
    const roles =
      needRoles && meta.studentId
        ? await this.repo.recipientEmails(meta.studentId)
        : { primary: null, secondary: null, guardian: null };

    const to = new Set<string>();
    if (includePrimary && roles.primary) to.add(roles.primary);
    if (dto.includeSecondaryParent && roles.secondary) to.add(roles.secondary);
    if (dto.includeGuardian && roles.guardian) to.add(roles.guardian);
    for (const e of dto.to ?? []) if (EMAIL_RE.test(e)) to.add(e.trim());

    const cc = (dto.cc ?? []).filter((e) => EMAIL_RE.test(e)).map((e) => e.trim());
    const bcc = (dto.bcc ?? []).filter((e) => EMAIL_RE.test(e)).map((e) => e.trim());
    return { to: [...to], cc, bcc };
  }

  private escapeHtml(s: string): string {
    return s.replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
    );
  }
}
