import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Document } from '@prisma/client';
import { StorageService, type PresignedUpload } from '../../common/storage.service';
import { TenantContextStore } from '../../prisma/tenant-context';
import { requireTenantId } from '../../common/tenant.util';
import { ParentScopeService } from '../common/parent-scope.service';
import { DocumentRepository } from './document.repository';
import type { ConfirmDocumentDto, PresignDocumentDto } from './document.dto';

@Injectable()
export class DocumentService {
  constructor(
    private readonly repo: DocumentRepository,
    private readonly storage: StorageService,
    private readonly scope: ParentScopeService,
  ) {}

  /** Step 1: get a pre-signed S3 URL to upload the file directly. */
  async presign(dto: PresignDocumentDto): Promise<PresignedUpload> {
    await this.scope.assertManageAccess(dto.studentId);
    if (!(await this.repo.studentExists(dto.studentId))) {
      throw new BadRequestException('Student not found in this tenant');
    }
    const key = this.storage.buildKey(
      requireTenantId(),
      `documents/${dto.studentId}`,
      dto.fileName,
    );
    return this.storage.presignUpload(key, dto.contentType);
  }

  /** Step 2: persist the vault entry after the client finishes uploading. */
  async confirm(dto: ConfirmDocumentDto): Promise<Document> {
    await this.scope.assertManageAccess(dto.studentId);
    this.storage.assertKeyInTenant(dto.fileKey);
    this.storage.assertUploadAllowed(dto.contentType, dto.size);
    return this.repo.create({
      studentId: dto.studentId,
      title: dto.title,
      category: dto.category,
      fileKey: dto.fileKey,
      fileName: dto.fileName,
      contentType: dto.contentType,
      size: dto.size,
      uploadedById: TenantContextStore.get()?.actorUserId ?? null,
    });
  }

  /** List vault entries (with fresh download URLs). Parents are scoped to their children. */
  async list(studentId?: string): Promise<Array<Document & { downloadUrl: string }>> {
    let docs: Document[];
    if (studentId) {
      await this.scope.assertManageAccess(studentId);
      docs = await this.repo.findByStudent(studentId);
    } else if (await this.scope.isParent()) {
      const childIds = await this.scope.childIds();
      docs = childIds.length === 0 ? [] : await this.repo.findForStudents(childIds);
    } else {
      // Staff must scope by student to avoid an unbounded tenant-wide dump.
      throw new BadRequestException('studentId query parameter is required');
    }
    return Promise.all(
      docs.map(async (doc) => ({
        ...doc,
        downloadUrl: await this.storage.presignDownload(doc.fileKey),
      })),
    );
  }

  async download(id: string): Promise<{ downloadUrl: string }> {
    const doc = await this.getAccessible(id);
    return { downloadUrl: await this.storage.presignDownload(doc.fileKey) };
  }

  async remove(id: string): Promise<void> {
    await this.getAccessible(id);
    await this.repo.softDelete(id);
  }

  private async getAccessible(id: string): Promise<Document> {
    const doc = await this.repo.findById(id);
    if (!doc) throw new NotFoundException('Document not found');
    await this.scope.assertManageAccess(doc.studentId);
    return doc;
  }
}
