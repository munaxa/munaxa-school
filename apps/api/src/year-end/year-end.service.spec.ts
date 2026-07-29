import { BadRequestException } from '@nestjs/common';
import { EnrollmentStatus, YearEndAction, YearEndProcessStatus } from '@prisma/client';
import { YearEndProcessingService } from './year-end.service';
import type { YearEndRepository } from './year-end.repository';
import type { AdmissionsService } from '../finance/admissions/admissions.service';
import type { QuoteService } from '../finance/admissions/quote.service';
import type { EnrollmentLifecycleService } from '../people/enrollment-lifecycle/enrollment-lifecycle.service';

function make(decisions: unknown[] = []) {
  const getDecision = jest.fn();
  const getProcess = jest.fn().mockResolvedValue({
    id: 'p1',
    status: YearEndProcessStatus.OPEN,
    targetAcademicYearId: 'ay-target',
  });
  const updateDecision = jest.fn().mockResolvedValue({});
  const markProcessCommitted = jest.fn().mockResolvedValue({});
  const repo = {
    academicYear: jest.fn(),
    openProcessForSource: jest.fn().mockResolvedValue(null),
    createProcessWithBoard: jest.fn(),
    getProcess,
    listDecisions: jest.fn().mockResolvedValue(decisions),
    studentsByIds: jest.fn().mockResolvedValue([]),
    getDecision,
    updateDecision,
    studentFinancialAccountId: jest.fn().mockResolvedValue('payer-1'),
    markProcessCommitted,
    cancelProcess: jest.fn(),
  } as unknown as YearEndRepository;
  const addStudentToFamily = jest.fn().mockResolvedValue({ enrollmentId: 'enr-new' });
  const quote = jest.fn().mockResolvedValue({ quoteId: 'q-new' });
  const transition = jest.fn().mockResolvedValue({});
  const admissions = { addStudentToFamily } as unknown as AdmissionsService;
  const quotes = { quote } as unknown as QuoteService;
  const lifecycle = { transition } as unknown as EnrollmentLifecycleService;
  const service = new YearEndProcessingService(repo, admissions, quotes, lifecycle);
  return {
    service,
    getDecision,
    getProcess,
    updateDecision,
    markProcessCommitted,
    addStudentToFamily,
    quote,
    transition,
  };
}

const decision = (over: Record<string, unknown>) => ({
  id: 'd1',
  processId: 'p1',
  studentId: 's1',
  sourceEnrollmentId: 'e1',
  action: YearEndAction.DECIDE_LATER,
  targetGradeId: null,
  targetSectionId: null,
  committedAt: null,
  reason: null,
  ...over,
});

describe('YearEndProcessingService — preview guards', () => {
  it('open() rejects identical source and target years', async () => {
    const { service } = make();
    await expect(
      service.open({ sourceAcademicYearId: 'ay', targetAcademicYearId: 'ay' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('setDecision() requires a target grade for PROMOTE (Decision 10 — never auto-copied)', async () => {
    const { service, getDecision } = make();
    getDecision.mockResolvedValue(decision({}));
    await expect(service.setDecision('d1', { action: YearEndAction.PROMOTE })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('setDecision() is blocked once the run is not OPEN', async () => {
    const { service, getDecision, getProcess } = make();
    getDecision.mockResolvedValue(decision({}));
    getProcess.mockResolvedValue({ status: YearEndProcessStatus.COMMITTED });
    await expect(service.setDecision('d1', { action: YearEndAction.GRADUATE })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('YearEndProcessingService.commit — action routing (nothing until Final Confirm)', () => {
  it('graduates and withdraws via the lifecycle service; promotes via the shared pipeline', async () => {
    const { service, addStudentToFamily, quote, transition } = make([
      decision({
        id: 'dg',
        studentId: 'sg',
        sourceEnrollmentId: 'eg',
        action: YearEndAction.GRADUATE,
      }),
      decision({
        id: 'dw',
        studentId: 'sw',
        sourceEnrollmentId: 'ew',
        action: YearEndAction.WITHDRAW,
      }),
      decision({
        id: 'dp',
        studentId: 'sp',
        sourceEnrollmentId: 'ep',
        action: YearEndAction.PROMOTE,
        targetGradeId: 'g-next',
        targetSectionId: 'sec-b',
      }),
      decision({ id: 'dl', action: YearEndAction.DECIDE_LATER }),
      decision({ id: 'dc', action: YearEndAction.GRADUATE, committedAt: new Date() }),
    ]);

    const res = await service.commit('p1');

    expect(res).toMatchObject({ promoted: 1, graduated: 1, withdrawn: 1 });
    // DECIDE_LATER + already-committed are skipped.
    expect(res.skipped).toBe(2);
    expect(transition).toHaveBeenCalledWith('eg', EnrollmentStatus.GRADUATED, {});
    expect(transition).toHaveBeenCalledWith('ew', EnrollmentStatus.WITHDRAWN, {});
    expect(transition).toHaveBeenCalledWith('ep', EnrollmentStatus.PROMOTED, {});
    // Promotion generates a quote for the assigned grade + target year, then reuses the shared pipeline.
    expect(quote).toHaveBeenCalledWith(
      expect.objectContaining({ gradeId: 'g-next', academicYearId: 'ay-target', persist: true }),
    );
    expect(addStudentToFamily).toHaveBeenCalledWith(
      'payer-1',
      expect.objectContaining({ existingStudentId: 'sp', quoteId: 'q-new', sectionId: 'sec-b' }),
    );
  });

  it('records a per-student failure and continues the batch', async () => {
    const { service, transition, updateDecision, markProcessCommitted } = make([
      decision({ id: 'dg', sourceEnrollmentId: 'eg', action: YearEndAction.GRADUATE }),
    ]);
    transition.mockRejectedValueOnce(new Error('boom'));

    const res = await service.commit('p1');
    expect(res.failed).toBe(1);
    expect(updateDecision).toHaveBeenCalledWith(
      'dg',
      expect.objectContaining({ needsReview: true }),
    );
    expect(markProcessCommitted).toHaveBeenCalledWith('p1');
  });
});
