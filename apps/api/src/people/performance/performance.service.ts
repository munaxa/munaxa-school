import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PerformanceReviewStatus, type Prisma } from '@prisma/client';
import { PerformanceRepository, type ReviewView } from './performance.repository';
import type {
  CreatePerformanceCycleDto,
  CreatePerformanceGoalDto,
  CreatePerformanceReviewDto,
  UpdatePerformanceCycleDto,
  UpdatePerformanceGoalDto,
  UpdatePerformanceReviewDto,
} from './performance.dto';

@Injectable()
export class PerformanceService {
  constructor(private readonly repo: PerformanceRepository) {}

  // ----- Cycles --------------------------------------------------------------
  createCycle(dto: CreatePerformanceCycleDto) {
    const { startDate, endDate } = this.range(dto.startDate, dto.endDate);
    return this.repo.createCycle({
      name: dto.name,
      startDate,
      endDate,
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    });
  }
  listCycles() {
    return this.repo.listCycles();
  }
  async updateCycle(id: string, dto: UpdatePerformanceCycleDto) {
    await this.getCycle(id);
    const data: Prisma.PerformanceCycleUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      throw new BadRequestException('endDate must be on or after startDate');
    }
    return this.repo.updateCycle(id, data);
  }
  async removeCycle(id: string) {
    await this.getCycle(id);
    await this.repo.softDeleteCycle(id);
  }

  // ----- Reviews -------------------------------------------------------------
  async createReview(employeeId: string, dto: CreatePerformanceReviewDto): Promise<ReviewView> {
    await this.assertEmployee(employeeId);
    await this.getCycle(dto.cycleId);
    return this.repo.createReview(dto.cycleId, employeeId);
  }
  async listReviews(employeeId: string): Promise<ReviewView[]> {
    await this.assertEmployee(employeeId);
    return this.repo.listReviewsForEmployee(employeeId);
  }
  getReview(id: string): Promise<ReviewView> {
    return this.requireReview(id);
  }
  async updateReview(id: string, dto: UpdatePerformanceReviewDto): Promise<ReviewView> {
    const review = await this.requireReview(id);
    if (review.status === PerformanceReviewStatus.ACKNOWLEDGED) {
      throw new BadRequestException('An acknowledged review can no longer be edited');
    }
    const data: Prisma.PerformanceReviewUncheckedUpdateInput = {};
    if (dto.overallRating !== undefined) data.overallRating = dto.overallRating;
    if (dto.summary !== undefined) data.summary = dto.summary;
    if (dto.strengths !== undefined) data.strengths = dto.strengths;
    if (dto.improvements !== undefined) data.improvements = dto.improvements;
    return this.repo.updateReview(id, data, 'performance_review.update');
  }
  async submitReview(id: string): Promise<ReviewView> {
    const review = await this.requireReview(id);
    if (review.status !== PerformanceReviewStatus.DRAFT) {
      throw new BadRequestException('Only a draft review can be submitted');
    }
    return this.repo.updateReview(
      id,
      { status: PerformanceReviewStatus.SUBMITTED, submittedAt: new Date() },
      'performance_review.submit',
    );
  }
  async acknowledgeReview(id: string): Promise<ReviewView> {
    const review = await this.requireReview(id);
    if (review.status !== PerformanceReviewStatus.SUBMITTED) {
      throw new BadRequestException('Only a submitted review can be acknowledged');
    }
    return this.repo.updateReview(
      id,
      { status: PerformanceReviewStatus.ACKNOWLEDGED, acknowledgedAt: new Date() },
      'performance_review.acknowledge',
    );
  }

  // ----- Goals ---------------------------------------------------------------
  async createGoal(reviewId: string, dto: CreatePerformanceGoalDto) {
    const review = await this.requireReview(reviewId);
    return this.repo.createGoal(reviewId, review.employeeId, {
      title: dto.title,
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.weight !== undefined ? { weight: dto.weight } : {}),
      ...(dto.dueDate !== undefined ? { dueDate: new Date(dto.dueDate) } : {}),
    });
  }
  async updateGoal(id: string, dto: UpdatePerformanceGoalDto) {
    await this.requireGoal(id);
    const data: Prisma.PerformanceGoalUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.weight !== undefined) data.weight = dto.weight;
    if (dto.progress !== undefined) data.progress = dto.progress;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.rating !== undefined) data.rating = dto.rating;
    if (dto.dueDate !== undefined) data.dueDate = new Date(dto.dueDate);
    return this.repo.updateGoal(id, data);
  }
  async removeGoal(id: string) {
    await this.requireGoal(id);
    await this.repo.deleteGoal(id);
  }

  // ----- Helpers -------------------------------------------------------------
  private range(startStr: string, endStr: string) {
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    if (endDate < startDate) throw new BadRequestException('endDate must be on or after startDate');
    return { startDate, endDate };
  }
  private async getCycle(id: string) {
    const cycle = await this.repo.findCycle(id);
    if (!cycle) throw new NotFoundException('Performance cycle not found');
    return cycle;
  }
  private async requireReview(id: string): Promise<ReviewView> {
    const review = await this.repo.findReview(id);
    if (!review) throw new NotFoundException('Performance review not found');
    return review;
  }
  private async requireGoal(id: string) {
    const goal = await this.repo.findGoal(id);
    if (!goal) throw new NotFoundException('Performance goal not found');
    return goal;
  }
  private async assertEmployee(employeeId: string) {
    if (!(await this.repo.employeeExists(employeeId))) {
      throw new NotFoundException('Employee not found');
    }
  }
}
