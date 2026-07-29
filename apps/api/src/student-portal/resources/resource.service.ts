import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Resource } from '@prisma/client';
import { StorageService, type PresignedUpload } from '../../common/storage.service';
import { TenantContextStore } from '../../prisma/tenant-context';
import { requireTenantId } from '../../common/tenant.util';
import { ResourceRepository } from './resource.repository';
import type { CreateResourceDto, PresignResourceDto } from './resource.dto';

/** A resource enriched with a fresh download URL for file-backed types. */
export type ResourceView = Resource & { downloadUrl?: string };

@Injectable()
export class ResourceService {
  constructor(
    private readonly repo: ResourceRepository,
    private readonly storage: StorageService,
  ) {}

  presign(dto: PresignResourceDto): Promise<PresignedUpload> {
    const key = this.storage.buildKey(requireTenantId(), 'resources', dto.fileName);
    return this.storage.presignUpload(key, dto.contentType);
  }

  async create(dto: CreateResourceDto): Promise<Resource> {
    if ((dto.type === 'LINK' || dto.type === 'VIDEO') && !dto.url) {
      throw new BadRequestException('url is required for LINK/VIDEO resources');
    }
    if ((dto.type === 'FILE' || dto.type === 'DOCUMENT') && !dto.fileKey) {
      throw new BadRequestException('fileKey is required for FILE/DOCUMENT resources');
    }
    if (dto.fileKey) {
      // Reject a fileKey pointing at another tenant's object (cross-tenant download via presign).
      this.storage.assertKeyInTenant(dto.fileKey);
      if (dto.contentType) this.storage.assertUploadAllowed(dto.contentType, dto.size);
    }
    if (dto.sectionId && !(await this.repo.sectionExists(dto.sectionId))) {
      throw new BadRequestException('Section not found in this tenant');
    }
    return this.repo.create({
      title: dto.title,
      description: dto.description ?? null,
      type: dto.type,
      sectionId: dto.sectionId ?? null,
      gradeId: dto.gradeId ?? null,
      subject: dto.subject ?? null,
      url: dto.url ?? null,
      fileKey: dto.fileKey ?? null,
      fileName: dto.fileName ?? null,
      contentType: dto.contentType ?? null,
      size: dto.size ?? null,
      uploadedById: TenantContextStore.get()?.actorUserId ?? null,
    });
  }

  async list(): Promise<ResourceView[]> {
    return this.withDownloadUrls(await this.repo.findMany());
  }

  async listForStudent(sectionId: string | null): Promise<ResourceView[]> {
    const gradeId = sectionId ? await this.repo.sectionGradeId(sectionId) : null;
    return this.withDownloadUrls(await this.repo.findForStudent(sectionId, gradeId));
  }

  async remove(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Resource not found');
    await this.repo.softDelete(id);
  }

  private withDownloadUrls(resources: Resource[]): Promise<ResourceView[]> {
    return Promise.all(
      resources.map(async (r) =>
        r.fileKey ? { ...r, downloadUrl: await this.storage.presignDownload(r.fileKey) } : { ...r },
      ),
    );
  }
}
