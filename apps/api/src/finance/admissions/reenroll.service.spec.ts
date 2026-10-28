import type { DomainEvents } from '../../events/domain-events';
import type { SubscriptionService } from '../../subscription/subscription.service';
import { BadRequestException } from '@nestjs/common';
import { AdmissionsService } from './admissions.service';
import { AddFamilyStudentMode, type ReEnrollDto } from './admissions.dto';
import type { AdmissionsRepository } from './admissions.repository';
import type { QuoteService } from './quote.service';
import type { RegistrationAgreementService } from '../../documents/registration-agreement.service';

function setup(ctx: { financialAccountId: string | null; alreadyEnrolled: boolean }) {
  const reEnrollContext = jest.fn().mockResolvedValue({
    financialAccountId: ctx.financialAccountId,
    academicYearId: 'ay-2027',
    alreadyEnrolled: ctx.alreadyEnrolled,
  });
  const addStudentToFamily = jest.fn().mockResolvedValue({
    enrollmentId: 'enr-new',
    mode: 'NEW_PLAN',
    planId: 'plan-1',
  });
  const repo = { reEnrollContext, addStudentToFamily } as unknown as AdmissionsRepository;
  // The agreement service is only used via a fire-and-forget scheduler; stub tryAutoGenerate.
  const agreements = {
    tryAutoGenerate: jest.fn().mockResolvedValue(undefined),
  } as unknown as RegistrationAgreementService;
  const quote = {} as unknown as QuoteService;
  // Re-enrolment never creates a student, so it never asks for capacity or publishes a total.
  const subscriptions = {
    capacity: jest.fn().mockRejectedValue(new Error('capacity is not asked on re-enrolment')),
  } as unknown as SubscriptionService;
  const events = { emit: jest.fn() } as unknown as DomainEvents;
  const service = new AdmissionsService(repo, quote, agreements, subscriptions, events);
  return { service, reEnrollContext, addStudentToFamily };
}

const dto: ReEnrollDto = {
  studentId: 'stu-1',
  quoteId: 'quote-1',
  idempotencyKey: 'idem-1',
};

describe('AdmissionsService.reEnroll (Step 7 — shared pipeline, never recreates the student)', () => {
  it('rejects re-enrolling a student already enrolled for that year', async () => {
    const { service, addStudentToFamily } = setup({
      financialAccountId: 'payer-1',
      alreadyEnrolled: true,
    });
    await expect(service.reEnroll(dto)).rejects.toThrow(BadRequestException);
    expect(addStudentToFamily).not.toHaveBeenCalled();
  });

  it('rejects when the student has no Financial Account and none is provided', async () => {
    const { service, addStudentToFamily } = setup({
      financialAccountId: null,
      alreadyEnrolled: false,
    });
    await expect(service.reEnroll(dto)).rejects.toThrow(BadRequestException);
    expect(addStudentToFamily).not.toHaveBeenCalled();
  });

  it('delegates to the shared add-to-account pipeline with existingStudentId', async () => {
    const { service, addStudentToFamily } = setup({
      financialAccountId: 'payer-1',
      alreadyEnrolled: false,
    });
    const result = await service.reEnroll(dto);
    expect(result.enrollmentId).toBe('enr-new');
    expect(addStudentToFamily).toHaveBeenCalledWith(
      'payer-1',
      expect.objectContaining({
        existingStudentId: 'stu-1',
        quoteId: 'quote-1',
        mode: AddFamilyStudentMode.NEW_PLAN,
      }),
      // No new student, so no place under the plan's limit is taken.
      { limit: null, refusal: null },
    );
  });

  it('honours an explicit financialAccountId override', async () => {
    const { service, addStudentToFamily } = setup({
      financialAccountId: null,
      alreadyEnrolled: false,
    });
    await service.reEnroll({ ...dto, financialAccountId: 'payer-override' });
    expect(addStudentToFamily).toHaveBeenCalledWith(
      'payer-override',
      expect.any(Object),
      expect.anything(),
    );
  });
});
