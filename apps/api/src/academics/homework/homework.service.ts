import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Homework, HomeworkAttachment } from '@prisma/client';
import { HomeworkRepository } from './homework.repository';
import { StorageService, type PresignedUpload } from '../../common/storage.service';
import { TenantContextStore } from '../../prisma/tenant-context';
import { requireTenantId } from '../../common/tenant.util';
import type {
  ConfirmAttachmentDto,
  CreateHomeworkDto,
  PresignAttachmentDto,
  UpdateHomeworkDto,
} from './homework.dto';

@Injectable()
export class HomeworkService {
  constructor(
    private readonly repo: HomeworkRepository,
    private readonly storage: StorageService,
  ) {}

  async create(dto: CreateHomeworkDto): Promise<Homework> {
    if (!(await this.repo.sectionExists(dto.sectionId))) {
      throw new BadRequestException('Section not found in this tenant');
    }
    return this.repo.create({
      sectionId: dto.sectionId,
      subject: dto.subject,
      title: dto.title,
      description: dto.description ?? null,
      dueDate: new Date(dto.dueDate),
      assignedById: TenantContextStore.get()?.actorUserId ?? null,
    });
  }

  listBySection(sectionId: string): Promise<Homework[]> {
    return this.repo.findBySection(sectionId);
  }

  async get(id: string): Promise<Homework> {
    const homework = await this.repo.findById(id);
    if (!homework) throw new NotFoundException('Homework not found');
    return homework;
  }

  async update(id: string, dto: UpdateHomeworkDto): Promise<Homework> {
    await this.get(id);
    return this.repo.update(id, {
      ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
    });
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.repo.softDelete(id);
  }

  // ----- Attachments (secure direct-to-S3 upload) --------------------------
  async presignAttachment(homeworkId: string, dto: PresignAttachmentDto): Promise<PresignedUpload> {
    await this.get(homeworkId);
    const key = this.storage.buildKey(requireTenantId(), `homework/${homeworkId}`, dto.fileName);
    return this.storage.presignUpload(key, dto.contentType, dto.size);
  }

  async confirmAttachment(
    homeworkId: string,
    dto: ConfirmAttachmentDto,
  ): Promise<HomeworkAttachment> {
    await this.get(homeworkId);
    // The client echoes back a fileKey from the presign step — verify it is the tenant's own key
    // and re-validate the declared type/size (the presign URL could be skipped entirely).
    this.storage.assertKeyInTenant(dto.fileKey);
    this.storage.assertUploadAllowed(dto.contentType, dto.size);
    return this.repo.addAttachment({
      homeworkId,
      fileName: dto.fileName,
      fileKey: dto.fileKey,
      contentType: dto.contentType,
      size: dto.size,
      uploadedById: TenantContextStore.get()?.actorUserId ?? null,
    });
  }

  async listAttachments(
    homeworkId: string,
  ): Promise<Array<HomeworkAttachment & { downloadUrl: string }>> {
    await this.get(homeworkId);
    const attachments = await this.repo.listAttachments(homeworkId);
    return Promise.all(
      attachments.map(async (attachment) => ({
        ...attachment,
        downloadUrl: await this.storage.presignDownload(attachment.fileKey),
      })),
    );
  }
}
