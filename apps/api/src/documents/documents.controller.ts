import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { DocumentsService } from './documents.service';
import {
  ConfirmSignedAgreementDto,
  EmailDocumentDto,
  GenerateAgreementDto,
  GenerateDocumentDto,
  PresignSignedAgreementDto,
} from './documents.dto';
import type { DocumentMeta } from './document.repository';
import type { AccessContext } from './document.types';

/**
 * Enterprise Document Engine API (Parts 3–6, 8). Generates official documents from a permanent
 * snapshot, lists the per-tenant archive, and serves stored PDFs for download/print/email. Every
 * action is RBAC-gated, tenant-isolated (RLS) and audited.
 */
@ApiTags('documents')
@ApiBearerAuth()
@Controller({ path: 'documents', version: '1' })
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get()
  @RequirePermissions(Permission.DOCUMENT_READ)
  @ApiOperation({ summary: 'List archived documents (optionally by student/type/enrollment)' })
  list(
    @Query('studentId') studentId?: string,
    @Query('type') type?: DocumentType,
    @Query('enrollmentId') enrollmentId?: string,
  ) {
    return this.service.list({
      ...(studentId ? { studentId } : {}),
      ...(type ? { type } : {}),
      ...(enrollmentId ? { enrollmentId } : {}),
    });
  }

  @Get('academic-years')
  @RequirePermissions(Permission.DOCUMENT_READ)
  @ApiOperation({ summary: 'Academic years (for the tuition-certificate picker)' })
  academicYears() {
    return this.service.academicYears();
  }

  @Post('generate')
  @RequirePermissions(Permission.DOCUMENT_GENERATE)
  @ApiOperation({ summary: 'Generate & archive an official finance document from the ledger' })
  generate(@Body() dto: GenerateDocumentDto): Promise<DocumentMeta> {
    return this.service.generate(dto);
  }

  @Get('agreements')
  @RequirePermissions(Permission.DOCUMENT_READ)
  @ApiOperation({ summary: 'List registration agreements (all versions)' })
  listAgreements(
    @Query('studentId') studentId?: string,
    @Query('enrollmentId') enrollmentId?: string,
  ) {
    return this.service.listAgreements({
      ...(studentId ? { studentId } : {}),
      ...(enrollmentId ? { enrollmentId } : {}),
    });
  }

  @Post('agreements')
  @RequirePermissions(Permission.DOCUMENT_GENERATE)
  @ApiOperation({
    summary:
      'Generate the registration agreement for an enrollment (idempotent — one per enrollment)',
  })
  generateAgreement(@Body() dto: GenerateAgreementDto) {
    return this.service.generateAgreement(dto);
  }

  @Post('agreements/:agreementId/signed/presign')
  @RequirePermissions(Permission.DOCUMENT_UPLOAD_SIGNED)
  @ApiOperation({ summary: 'Pre-sign an upload for the parent’s signed agreement (PDF/JPG/PNG)' })
  presignSigned(@Param('agreementId') agreementId: string, @Body() dto: PresignSignedAgreementDto) {
    return this.service.presignSignedAgreement(agreementId, dto);
  }

  @Post('agreements/:agreementId/signed')
  @RequirePermissions(Permission.DOCUMENT_UPLOAD_SIGNED)
  @ApiOperation({ summary: 'Confirm the uploaded signed agreement (first upload)' })
  uploadSigned(
    @Param('agreementId') agreementId: string,
    @Body() dto: ConfirmSignedAgreementDto,
    @Req() req: Request,
  ) {
    return this.service.confirmSignedAgreement(agreementId, dto, 'upload', this.ctx(req));
  }

  @Put('agreements/:agreementId/signed')
  @RequirePermissions(Permission.DOCUMENT_REPLACE_SIGNED)
  @ApiOperation({ summary: 'Replace an existing signed agreement (audited)' })
  replaceSigned(
    @Param('agreementId') agreementId: string,
    @Body() dto: ConfirmSignedAgreementDto,
    @Req() req: Request,
  ) {
    return this.service.confirmSignedAgreement(agreementId, dto, 'replace', this.ctx(req));
  }

  @Get('agreements/:agreementId/signed')
  @RequirePermissions(Permission.DOCUMENT_READ)
  @ApiOperation({ summary: 'Get a secure, short-lived URL to view the signed agreement (audited)' })
  viewSigned(@Param('agreementId') agreementId: string, @Req() req: Request) {
    return this.service.viewSignedAgreement(agreementId, this.ctx(req));
  }

  @Get('agreements/:agreementId/signed/blob')
  @RequirePermissions(Permission.DOCUMENT_READ)
  @ApiOperation({
    summary: 'Stream the signed agreement bytes through the API (works without object storage)',
  })
  async viewSignedBlob(
    @Param('agreementId') agreementId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, contentType, fileName } = await this.service.streamSignedAgreement(
      agreementId,
      this.ctx(req),
    );
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${fileName.replace(/[^A-Za-z0-9._-]/g, '_')}"`,
    });
    return new StreamableFile(buffer);
  }

  @Delete('agreements/:agreementId/signed')
  @RequirePermissions(Permission.DOCUMENT_DELETE_SIGNED)
  @ApiOperation({ summary: 'Delete the uploaded signed agreement (audited)' })
  deleteSigned(@Param('agreementId') agreementId: string, @Req() req: Request) {
    return this.service.deleteSignedAgreement(agreementId, this.ctx(req));
  }

  @Get(':id')
  @RequirePermissions(Permission.DOCUMENT_READ)
  @ApiOperation({ summary: 'Document metadata (no PDF body)' })
  getMeta(@Param('id') id: string) {
    return this.service.getMeta(id);
  }

  @Get(':id/history')
  @RequirePermissions(Permission.DOCUMENT_READ)
  @ApiOperation({ summary: 'Per-action access history (generate/print/download/email/view)' })
  history(@Param('id') id: string) {
    return this.service.accessHistory(id);
  }

  @Get(':id/download')
  @RequirePermissions(Permission.DOCUMENT_READ)
  @ApiOperation({ summary: 'Download the PDF — stored (SNAPSHOT) or re-rendered live (DYNAMIC)' })
  async download(
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { meta, pdf } = await this.service.download(id, this.ctx(req));
    return this.streamPdf(res, meta, pdf, 'inline');
  }

  @Post(':id/print')
  @RequirePermissions(Permission.DOCUMENT_READ)
  @ApiOperation({
    summary: 'Reprint the PDF (records a PRINT action); re-rendered live if DYNAMIC',
  })
  async print(
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { meta, pdf } = await this.service.print(id, this.ctx(req));
    return this.streamPdf(res, meta, pdf, 'inline');
  }

  @Post(':id/email')
  @RequirePermissions(Permission.DOCUMENT_GENERATE)
  @ApiOperation({
    summary: 'Email the document as a PDF attachment (audited; recipients resolved)',
  })
  email(@Param('id') id: string, @Body() dto: EmailDocumentDto, @Req() req: Request) {
    return this.service.email(id, dto, this.ctx(req));
  }

  /** Best-effort request context (client IP + user agent) for the access history. */
  private ctx(req: Request): AccessContext {
    const fwd = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim() || req.ip;
    return { ip: ip ?? undefined, userAgent: req.headers['user-agent'] ?? undefined };
  }

  private streamPdf(
    res: Response,
    meta: DocumentMeta,
    pdf: Buffer,
    disposition: 'inline' | 'attachment',
  ): StreamableFile {
    const filename = `${meta.type.toLowerCase()}-${String(meta.documentNo).padStart(6, '0')}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${filename}"`,
    });
    return new StreamableFile(pdf);
  }
}
