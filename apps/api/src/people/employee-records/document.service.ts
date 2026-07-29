import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { EmployeeDocument } from '@prisma/client';
import { StorageService, type PresignedUpload } from '../../common/storage.service';
import { requireTenantId } from '../../common/tenant.util';
import { EmployeeDocumentRepository } from './document.repository';
import type { CreateDocumentDto, PresignDocumentDto } from './document.dto';

/** A document enriched with a fresh presigned download URL. */
export type EmployeeDocumentView = EmployeeDocument & { downloadUrl: string };

@Injectable()
export class EmployeeDocumentService {
  constructor(
    private readonly repo: EmployeeDocumentRepository,
    private readonly storage: StorageService,
  ) {}

  async presign(employeeId: string, dto: PresignDocumentDto): Promise<PresignedUpload> {
    await this.assertEmployee(employeeId);
    const key = this.storage.buildKey(requireTenantId(), `employees/${employeeId}`, dto.fileName);
    return this.storage.presignUpload(key, dto.contentType, dto.size);
  }

  async create(employeeId: string, dto: CreateDocumentDto): Promise<EmployeeDocumentView> {
    await this.assertEmployee(employeeId);
    // Reject a fileKey pointing at another tenant's namespace (defence in depth) + type/size guard.
    this.storage.assertKeyInTenant(dto.fileKey);
    this.storage.assertUploadAllowed(dto.contentType, dto.size);

    let version = 1;
    if (dto.supersedesId) {
      const prev = await this.repo.findById(dto.supersedesId);
      if (!prev || prev.employeeId !== employeeId) {
        throw new BadRequestException('The document being superseded was not found.');
      }
      version = prev.version + 1;
    }

    const doc = await this.repo.create(employeeId, {
      type: dto.type,
      title: dto.title,
      fileKey: dto.fileKey,
      fileName: dto.fileName,
      contentType: dto.contentType,
      size: dto.size,
      version,
      ...(dto.supersedesId ? { supersedesId: dto.supersedesId } : {}),
      ...(dto.issueDate ? { issueDate: new Date(dto.issueDate) } : {}),
      ...(dto.expiryDate ? { expiryDate: new Date(dto.expiryDate) } : {}),
    });
    return this.withUrl(doc);
  }

  async list(employeeId: string): Promise<EmployeeDocumentView[]> {
    await this.assertEmployee(employeeId);
    const docs = await this.repo.listForEmployee(employeeId);
    return Promise.all(docs.map((d) => this.withUrl(d)));
  }

  async downloadUrl(employeeId: string, id: string): Promise<{ url: string }> {
    const doc = await this.getOwned(employeeId, id);
    return { url: await this.storage.presignDownload(doc.fileKey) };
  }

  async remove(employeeId: string, id: string): Promise<void> {
    await this.getOwned(employeeId, id);
    await this.repo.softDelete(id);
  }

  private async getOwned(employeeId: string, id: string): Promise<EmployeeDocument> {
    const doc = await this.repo.findById(id);
    if (!doc || doc.employeeId !== employeeId) throw new NotFoundException('Document not found');
    return doc;
  }

  private async assertEmployee(employeeId: string) {
    if (!(await this.repo.employeeExists(employeeId))) {
      throw new NotFoundException('Employee not found');
    }
  }

  private async withUrl(doc: EmployeeDocument): Promise<EmployeeDocumentView> {
    return { ...doc, downloadUrl: await this.storage.presignDownload(doc.fileKey) };
  }
}
