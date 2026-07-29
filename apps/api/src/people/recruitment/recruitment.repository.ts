import { Injectable } from '@nestjs/common';
import { ApplicantStatus, type Prisma, type Interview, type JobPosting } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

const POSTING_INCLUDE = {
  department: { select: { id: true, name: true } },
  position: { select: { id: true, title: true } },
  _count: { select: { applicants: true } },
} satisfies Prisma.JobPostingInclude;

const APPLICANT_INCLUDE = {
  posting: { select: { id: true, title: true } },
  interviews: { orderBy: { scheduledAt: 'asc' as const } },
} satisfies Prisma.JobApplicantInclude;

export type PostingView = Prisma.JobPostingGetPayload<{ include: typeof POSTING_INCLUDE }>;
export type ApplicantView = Prisma.JobApplicantGetPayload<{ include: typeof APPLICANT_INCLUDE }>;

@Injectable()
export class RecruitmentRepository extends TenantRepository {
  // ----- Postings ------------------------------------------------------------
  createPosting(
    data: Omit<Prisma.JobPostingUncheckedCreateInput, 'tenantId'>,
  ): Promise<PostingView> {
    return this.run(async (tx, tenantId) => {
      const posting = await tx.jobPosting.create({
        data: { ...data, tenantId },
        include: POSTING_INCLUDE,
      });
      await this.writeAudit(tx, tenantId, {
        action: 'job_posting.create',
        entityType: 'JobPosting',
        entityId: posting.id,
      });
      return posting;
    });
  }
  listPostings(status?: string): Promise<PostingView[]> {
    return this.run((tx) => {
      const where: Prisma.JobPostingWhereInput = { deletedAt: null };
      if (status) where.status = status as never;
      return tx.jobPosting.findMany({
        where,
        include: POSTING_INCLUDE,
        orderBy: { createdAt: 'desc' },
      });
    });
  }
  findPosting(id: string): Promise<JobPosting | null> {
    return this.run((tx) => tx.jobPosting.findFirst({ where: { id, deletedAt: null } }));
  }
  updatePosting(id: string, data: Prisma.JobPostingUncheckedUpdateInput): Promise<PostingView> {
    return this.run(async (tx, tenantId) => {
      const posting = await tx.jobPosting.update({
        where: { id },
        data,
        include: POSTING_INCLUDE,
      });
      await this.writeAudit(tx, tenantId, {
        action: 'job_posting.update',
        entityType: 'JobPosting',
        entityId: id,
      });
      return posting;
    });
  }
  softDeletePosting(id: string): Promise<JobPosting> {
    return this.run(async (tx, tenantId) => {
      const posting = await tx.jobPosting.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'job_posting.delete',
        entityType: 'JobPosting',
        entityId: id,
      });
      return posting;
    });
  }

  // ----- Applicants ----------------------------------------------------------
  createApplicant(
    postingId: string,
    data: Omit<Prisma.JobApplicantUncheckedCreateInput, 'tenantId' | 'postingId'>,
  ): Promise<ApplicantView> {
    return this.run(async (tx, tenantId) => {
      const applicant = await tx.jobApplicant.create({
        data: { ...data, tenantId, postingId },
        include: APPLICANT_INCLUDE,
      });
      await this.writeAudit(tx, tenantId, {
        action: 'job_applicant.create',
        entityType: 'JobApplicant',
        entityId: applicant.id,
        metadata: { postingId },
      });
      return applicant;
    });
  }
  listApplicants(postingId: string): Promise<ApplicantView[]> {
    return this.run((tx) =>
      tx.jobApplicant.findMany({
        where: { postingId },
        include: APPLICANT_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
    );
  }
  findApplicant(id: string): Promise<ApplicantView | null> {
    return this.run((tx) =>
      tx.jobApplicant.findFirst({ where: { id }, include: APPLICANT_INCLUDE }),
    );
  }
  updateApplicant(
    id: string,
    data: Prisma.JobApplicantUncheckedUpdateInput,
    action = 'job_applicant.update',
  ): Promise<ApplicantView> {
    return this.run(async (tx, tenantId) => {
      const applicant = await tx.jobApplicant.update({
        where: { id },
        data,
        include: APPLICANT_INCLUDE,
      });
      await this.writeAudit(tx, tenantId, {
        action,
        entityType: 'JobApplicant',
        entityId: id,
      });
      return applicant;
    });
  }

  /** Link a hired applicant to the created Employee and mark it HIRED (post-employee-creation). */
  markHired(id: string, employeeId: string): Promise<ApplicantView> {
    return this.run(async (tx, tenantId) => {
      const applicant = await tx.jobApplicant.update({
        where: { id },
        data: { status: ApplicantStatus.HIRED, hiredEmployeeId: employeeId },
        include: APPLICANT_INCLUDE,
      });
      await this.writeAudit(tx, tenantId, {
        action: 'job_applicant.hire',
        entityType: 'JobApplicant',
        entityId: id,
        metadata: { employeeId },
      });
      return applicant;
    });
  }

  // ----- Interviews ----------------------------------------------------------
  createInterview(
    applicantId: string,
    data: Omit<Prisma.InterviewUncheckedCreateInput, 'tenantId' | 'applicantId'>,
  ): Promise<Interview> {
    return this.run(async (tx, tenantId) => {
      const interview = await tx.interview.create({
        data: { ...data, tenantId, applicantId },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'interview.create',
        entityType: 'Interview',
        entityId: interview.id,
        metadata: { applicantId },
      });
      return interview;
    });
  }
  findInterview(id: string): Promise<Interview | null> {
    return this.run((tx) => tx.interview.findFirst({ where: { id } }));
  }
  updateInterview(id: string, data: Prisma.InterviewUncheckedUpdateInput): Promise<Interview> {
    return this.run(async (tx, tenantId) => {
      const interview = await tx.interview.update({ where: { id }, data });
      await this.writeAudit(tx, tenantId, {
        action: 'interview.update',
        entityType: 'Interview',
        entityId: id,
      });
      return interview;
    });
  }
  deleteInterview(id: string): Promise<void> {
    return this.run(async (tx, tenantId) => {
      await tx.interview.delete({ where: { id } });
      await this.writeAudit(tx, tenantId, {
        action: 'interview.delete',
        entityType: 'Interview',
        entityId: id,
      });
    });
  }
}
