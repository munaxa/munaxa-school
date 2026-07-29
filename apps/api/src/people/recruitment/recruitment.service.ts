import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ApplicantStatus, EmploymentStatus, JobPostingStatus, type Prisma } from '@prisma/client';
import { EmployeeService } from '../employees/employee.service';
import type { CreateEmployeeDto } from '../employees/employee.dto';
import {
  RecruitmentRepository,
  type ApplicantView,
  type PostingView,
} from './recruitment.repository';
import type {
  CreateApplicantDto,
  CreateInterviewDto,
  CreateJobPostingDto,
  HireApplicantDto,
  UpdateApplicantDto,
  UpdateInterviewDto,
  UpdateJobPostingDto,
} from './recruitment.dto';

@Injectable()
export class RecruitmentService {
  constructor(
    private readonly repo: RecruitmentRepository,
    private readonly employees: EmployeeService,
  ) {}

  // ----- Postings ------------------------------------------------------------
  createPosting(dto: CreateJobPostingDto): Promise<PostingView> {
    const openNow = dto.status === JobPostingStatus.OPEN;
    return this.repo.createPosting({
      title: dto.title,
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
      ...(dto.positionId !== undefined ? { positionId: dto.positionId } : {}),
      ...(dto.employmentType !== undefined ? { employmentType: dto.employmentType } : {}),
      ...(dto.location !== undefined ? { location: dto.location } : {}),
      ...(dto.headcount !== undefined ? { headcount: dto.headcount } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(openNow ? { openedAt: new Date() } : {}),
    });
  }
  listPostings(status?: string): Promise<PostingView[]> {
    return this.repo.listPostings(status);
  }
  async updatePosting(id: string, dto: UpdateJobPostingDto): Promise<PostingView> {
    const current = await this.getPosting(id);
    const data: Prisma.JobPostingUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.departmentId !== undefined) data.departmentId = dto.departmentId;
    if (dto.positionId !== undefined) data.positionId = dto.positionId;
    if (dto.employmentType !== undefined) data.employmentType = dto.employmentType;
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.headcount !== undefined) data.headcount = dto.headcount;
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === JobPostingStatus.OPEN && !current.openedAt) data.openedAt = new Date();
      if (
        (dto.status === JobPostingStatus.CLOSED || dto.status === JobPostingStatus.FILLED) &&
        !current.closedAt
      ) {
        data.closedAt = new Date();
      }
    }
    return this.repo.updatePosting(id, data);
  }
  async removePosting(id: string): Promise<void> {
    await this.getPosting(id);
    await this.repo.softDeletePosting(id);
  }

  // ----- Applicants ----------------------------------------------------------
  async createApplicant(postingId: string, dto: CreateApplicantDto): Promise<ApplicantView> {
    await this.getPosting(postingId);
    return this.repo.createApplicant(postingId, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.source !== undefined ? { source: dto.source } : {}),
      ...(dto.resumeUrl !== undefined ? { resumeUrl: dto.resumeUrl } : {}),
    });
  }
  async listApplicants(postingId: string): Promise<ApplicantView[]> {
    await this.getPosting(postingId);
    return this.repo.listApplicants(postingId);
  }
  getApplicant(id: string): Promise<ApplicantView> {
    return this.requireApplicant(id);
  }
  async updateApplicant(id: string, dto: UpdateApplicantDto): Promise<ApplicantView> {
    const applicant = await this.requireApplicant(id);
    if (applicant.status === ApplicantStatus.HIRED) {
      throw new BadRequestException('A hired applicant can no longer be edited');
    }
    const data: Prisma.JobApplicantUncheckedUpdateInput = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.rating !== undefined) data.rating = dto.rating;
    if (dto.notes !== undefined) data.notes = dto.notes;
    return this.repo.updateApplicant(id, data);
  }

  /**
   * Hire an applicant: create a real Employee (status HIRED, reusing {@link EmployeeService}) then
   * link the applicant to it. English names come from the applicant; Arabic names + job details from
   * the hire DTO (defaulting the job title to the posting title).
   */
  async hire(id: string, dto: HireApplicantDto): Promise<ApplicantView> {
    const applicant = await this.requireApplicant(id);
    if (applicant.status === ApplicantStatus.HIRED || applicant.hiredEmployeeId) {
      throw new BadRequestException('This applicant has already been hired');
    }
    const posting = await this.getPosting(applicant.postingId);

    const createDto: CreateEmployeeDto = {
      firstNameEn: applicant.firstName,
      lastNameEn: applicant.lastName,
      firstNameAr: dto.firstNameAr,
      lastNameAr: dto.lastNameAr,
      jobTitle: dto.jobTitle ?? posting.title,
      status: EmploymentStatus.HIRED,
      ...(dto.employeeNumber !== undefined ? { employeeNumber: dto.employeeNumber } : {}),
      ...((dto.departmentId ?? posting.departmentId)
        ? { departmentId: dto.departmentId ?? posting.departmentId ?? undefined }
        : {}),
      ...((dto.positionId ?? posting.positionId)
        ? { positionId: dto.positionId ?? posting.positionId ?? undefined }
        : {}),
      ...((dto.employmentType ?? posting.employmentType)
        ? { employmentType: dto.employmentType ?? posting.employmentType ?? undefined }
        : {}),
      ...(dto.hireDate !== undefined ? { hireDate: dto.hireDate } : {}),
    };

    const employee = await this.employees.create(createDto);
    return this.repo.markHired(id, employee.id);
  }

  // ----- Interviews ----------------------------------------------------------
  async createInterview(applicantId: string, dto: CreateInterviewDto) {
    await this.requireApplicant(applicantId);
    return this.repo.createInterview(applicantId, {
      scheduledAt: new Date(dto.scheduledAt),
      ...(dto.mode !== undefined ? { mode: dto.mode } : {}),
      ...(dto.interviewerId !== undefined ? { interviewerId: dto.interviewerId } : {}),
      ...(dto.stage !== undefined ? { stage: dto.stage } : {}),
    });
  }
  async updateInterview(id: string, dto: UpdateInterviewDto) {
    await this.requireInterview(id);
    const data: Prisma.InterviewUncheckedUpdateInput = {};
    if (dto.scheduledAt !== undefined) data.scheduledAt = new Date(dto.scheduledAt);
    if (dto.mode !== undefined) data.mode = dto.mode;
    if (dto.outcome !== undefined) data.outcome = dto.outcome;
    if (dto.rating !== undefined) data.rating = dto.rating;
    if (dto.feedback !== undefined) data.feedback = dto.feedback;
    return this.repo.updateInterview(id, data);
  }
  async removeInterview(id: string) {
    await this.requireInterview(id);
    await this.repo.deleteInterview(id);
  }

  // ----- Helpers -------------------------------------------------------------
  private async getPosting(id: string) {
    const posting = await this.repo.findPosting(id);
    if (!posting) throw new NotFoundException('Job posting not found');
    return posting;
  }
  private async requireApplicant(id: string): Promise<ApplicantView> {
    const applicant = await this.repo.findApplicant(id);
    if (!applicant) throw new NotFoundException('Applicant not found');
    return applicant;
  }
  private async requireInterview(id: string) {
    const interview = await this.repo.findInterview(id);
    if (!interview) throw new NotFoundException('Interview not found');
    return interview;
  }
}
