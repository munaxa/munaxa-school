import { EnrollmentChangeService } from './enrollment-change.service';
import type { EnrollmentChangeRepository } from './enrollment-change.repository';
import type { AdmissionsService } from '../finance/admissions/admissions.service';

function make() {
  const transfer = jest.fn().mockResolvedValue({ id: 'e1' });
  const correctGrade = jest.fn();
  const repo = { transfer, correctGrade } as unknown as EnrollmentChangeRepository;
  const feeComparison = jest.fn().mockResolvedValue({ delta: '50.000' });
  const recalculateFees = jest.fn().mockResolvedValue({ newChargeId: 'c9' });
  const admissions = { feeComparison, recalculateFees } as unknown as AdmissionsService;
  return {
    service: new EnrollmentChangeService(repo, admissions),
    transfer,
    correctGrade,
    feeComparison,
    recalculateFees,
  };
}

describe('EnrollmentChangeService', () => {
  it('transfer delegates to the repository', async () => {
    const { service, transfer } = make();
    const res = await service.transfer('e1', { sectionId: 's2' });
    expect(transfer).toHaveBeenCalledWith('e1', { sectionId: 's2' });
    expect(res).toEqual({ enrollmentId: 'e1', transferred: true });
  });

  it('grade correction surfaces a fee warning when the grade actually changes', async () => {
    const { service, correctGrade } = make();
    correctGrade.mockResolvedValue({ enrollment: { id: 'e1' }, feesMayChange: true });
    const res = await service.correctGrade('e1', { gradeId: 'g1' });
    expect(res.feesMayChange).toBe(true);
    expect(res.feeWarning).toMatch(/review fees in Finance/i);
  });

  it('grade correction has no fee warning when the grade is unchanged', async () => {
    const { service, correctGrade } = make();
    correctGrade.mockResolvedValue({ enrollment: { id: 'e1' }, feesMayChange: false });
    const res = await service.correctGrade('e1', { gradeId: 'g1' });
    expect(res.feesMayChange).toBe(false);
    expect(res.feeWarning).toBeNull();
  });

  it('fee comparison and recalculation delegate to AdmissionsService (finance stays the SoT)', async () => {
    const { service, feeComparison, recalculateFees } = make();
    await service.feeComparison('e1');
    expect(feeComparison).toHaveBeenCalledWith('e1');
    await service.recalculateFees('e1');
    expect(recalculateFees).toHaveBeenCalledWith('e1');
  });
});
