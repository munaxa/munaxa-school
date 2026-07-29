import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TrainingRecordStatus, type Prisma } from '@prisma/client';
import { TrainingRepository, type TrainingRecordView } from './training.repository';
import type {
  CreateTrainingCourseDto,
  EnrollTrainingDto,
  UpdateTrainingCourseDto,
  UpdateTrainingRecordDto,
} from './training.dto';

@Injectable()
export class TrainingService {
  constructor(private readonly repo: TrainingRepository) {}

  // ----- Courses -------------------------------------------------------------
  createCourse(dto: CreateTrainingCourseDto) {
    return this.repo.createCourse({
      title: dto.title,
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.provider !== undefined ? { provider: dto.provider } : {}),
      ...(dto.hours !== undefined ? { hours: dto.hours } : {}),
      ...(dto.mandatory !== undefined ? { mandatory: dto.mandatory } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });
  }
  listCourses() {
    return this.repo.listCourses();
  }
  async updateCourse(id: string, dto: UpdateTrainingCourseDto) {
    await this.getCourse(id);
    const data: Prisma.TrainingCourseUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.provider !== undefined) data.provider = dto.provider;
    if (dto.hours !== undefined) data.hours = dto.hours;
    if (dto.mandatory !== undefined) data.mandatory = dto.mandatory;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return this.repo.updateCourse(id, data);
  }
  async removeCourse(id: string) {
    await this.getCourse(id);
    await this.repo.softDeleteCourse(id);
  }

  // ----- Records -------------------------------------------------------------
  async enroll(employeeId: string, dto: EnrollTrainingDto): Promise<TrainingRecordView> {
    await this.assertEmployee(employeeId);
    await this.getCourse(dto.courseId);
    return this.repo.enroll(employeeId, dto.courseId);
  }
  async listForEmployee(employeeId: string): Promise<TrainingRecordView[]> {
    await this.assertEmployee(employeeId);
    return this.repo.listForEmployee(employeeId);
  }
  async updateRecord(id: string, dto: UpdateTrainingRecordDto): Promise<TrainingRecordView> {
    await this.getRecord(id);
    const data: Prisma.TrainingRecordUncheckedUpdateInput = {};
    if (dto.status !== undefined) {
      data.status = dto.status;
      // Auto-stamp completion when moving to COMPLETED without an explicit date.
      if (dto.status === TrainingRecordStatus.COMPLETED && dto.completedAt === undefined) {
        data.completedAt = new Date();
      }
    }
    if (dto.completedAt !== undefined) data.completedAt = new Date(dto.completedAt);
    if (dto.score !== undefined) data.score = dto.score;
    if (dto.expiresAt !== undefined) data.expiresAt = new Date(dto.expiresAt);
    if (dto.certificateId !== undefined) data.certificateId = dto.certificateId;
    if (dto.note !== undefined) data.note = dto.note;
    return this.repo.updateRecord(id, data);
  }
  async removeRecord(id: string) {
    await this.getRecord(id);
    await this.repo.deleteRecord(id);
  }
  expiring(within: number): Promise<TrainingRecordView[]> {
    if (within <= 0) throw new BadRequestException('`within` must be a positive number of days');
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() + within);
    return this.repo.expiringBefore(cutoff);
  }

  // ----- Helpers -------------------------------------------------------------
  private async getCourse(id: string) {
    const course = await this.repo.findCourse(id);
    if (!course) throw new NotFoundException('Training course not found');
    return course;
  }
  private async getRecord(id: string) {
    const record = await this.repo.findRecord(id);
    if (!record) throw new NotFoundException('Training record not found');
    return record;
  }
  private async assertEmployee(employeeId: string) {
    if (!(await this.repo.employeeExists(employeeId))) {
      throw new NotFoundException('Employee not found');
    }
  }
}
