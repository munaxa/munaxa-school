import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdmissionStatus, EnrollmentStatus } from '@prisma/client';
import { EnrollmentExitService } from './enrollment-exit.service';
import type {
  EnrollmentExitRepository,
  EnrollmentChargeSummary,
} from './enrollment-exit.repository';
import type { ChargeService } from '../finance/charges/charge.service';
import type { EnrollmentLifecycleService } from '../people/enrollment-lifecycle/enrollment-lifecycle.service';

const charge = (over: Partial<EnrollmentChargeSummary['charges'][number]>) => ({
  id: 'c1',
  status: 'PENDING',
  isRegistration: false,
  fullyUnpaid: true,
  ...over,
});

function make(summary: EnrollmentChargeSummary | null) {
  const chargeSummary = jest.fn().mockResolvedValue(summary);
  const voidAdmission = jest.fn().mockResolvedValue({});
  const auditWithdrawalSettlement = jest.fn().mockResolvedValue({});
  const auditReactivation = jest.fn().mockResolvedValue({});
  const repo = {
    chargeSummary,
    voidAdmission,
    auditWithdrawalSettlement,
    auditReactivation,
  } as unknown as EnrollmentExitRepository;
  const cancel = jest.fn().mockResolvedValue({});
  const reopen = jest.fn().mockResolvedValue({});
  const transition = jest.fn().mockResolvedValue({});
  const charges = { cancel, reopen } as unknown as ChargeService;
  const lifecycle = { transition } as unknown as EnrollmentLifecycleService;
  const service = new EnrollmentExitService(repo, charges, lifecycle);
  return { service, cancel, reopen, transition, voidAdmission, auditWithdrawalSettlement };
}

const summary = (over: Partial<EnrollmentChargeSummary>): EnrollmentChargeSummary => ({
  enrollmentId: 'e1',
  studentId: 's1',
  admissionStatus: AdmissionStatus.REGISTERED,
  status: EnrollmentStatus.ACTIVE,
  charges: [],
  hasSettledMoney: false,
  ...over,
});

describe('EnrollmentExitService.withdraw (academic + settlement, Decision 11)', () => {
  it('marks WITHDRAWN and cancels unpaid non-registration charges, keeping the registration fee', async () => {
    const { service, cancel, transition } = make(
      summary({
        charges: [
          charge({ id: 'tuition', isRegistration: false, fullyUnpaid: true }),
          charge({ id: 'reg', isRegistration: true, fullyUnpaid: true }),
          charge({ id: 'paid', isRegistration: false, status: 'PAID' }),
        ],
      }),
    );

    const res = await service.withdraw('e1', {});
    expect(transition).toHaveBeenCalledWith('e1', EnrollmentStatus.WITHDRAWN, {});
    expect(cancel).toHaveBeenCalledWith('tuition');
    expect(cancel).not.toHaveBeenCalledWith('reg'); // registration fee kept
    expect(cancel).not.toHaveBeenCalledWith('paid'); // paid charge kept
    expect(res.cancelledChargeIds).toEqual(['tuition']);
  });

  it('can cancel the registration fee too when keepRegistrationFee=false', async () => {
    const { service, cancel } = make(
      summary({ charges: [charge({ id: 'reg', isRegistration: true, fullyUnpaid: true })] }),
    );
    await service.withdraw('e1', { keepRegistrationFee: false });
    expect(cancel).toHaveBeenCalledWith('reg');
  });

  it('404s an unknown enrollment', async () => {
    const { service } = make(null);
    await expect(service.withdraw('nope', {})).rejects.toThrow(NotFoundException);
  });
});

describe('EnrollmentExitService.cancelAdmission (void, Decision 11)', () => {
  it('voids all charges and cancels the admission when nothing is paid', async () => {
    const { service, cancel, voidAdmission } = make(
      summary({ charges: [charge({ id: 'a' }), charge({ id: 'b', status: 'CANCELLED' })] }),
    );
    const res = await service.cancelAdmission('e1', { reason: 'duplicate' });
    expect(cancel).toHaveBeenCalledWith('a');
    expect(cancel).not.toHaveBeenCalledWith('b'); // already cancelled
    expect(voidAdmission).toHaveBeenCalledWith('e1', 'duplicate');
    expect(res.voidedChargeIds).toEqual(['a']);
  });

  it('refuses to cancel once any money is settled (withdraw instead)', async () => {
    const { service, voidAdmission } = make(summary({ hasSettledMoney: true }));
    await expect(service.cancelAdmission('e1', {})).rejects.toThrow(BadRequestException);
    expect(voidAdmission).not.toHaveBeenCalled();
  });
});

describe('EnrollmentExitService.reactivate (reverse of withdraw)', () => {
  it('returns to ACTIVE and re-opens the charges the withdrawal cancelled', async () => {
    const { service, reopen, transition } = make(
      summary({
        status: EnrollmentStatus.WITHDRAWN,
        charges: [
          charge({ id: 'tuition', status: 'CANCELLED' }),
          charge({ id: 'reg', status: 'PENDING' }), // registration was kept — not re-opened
          charge({ id: 'paid', status: 'PAID' }),
        ],
      }),
    );
    const res = await service.reactivate('e1', {});
    expect(transition).toHaveBeenCalledWith('e1', EnrollmentStatus.ACTIVE, {});
    expect(reopen).toHaveBeenCalledWith('tuition');
    expect(reopen).not.toHaveBeenCalledWith('reg');
    expect(reopen).not.toHaveBeenCalledWith('paid');
    expect(res.reopenedChargeIds).toEqual(['tuition']);
  });

  it('refuses to reactivate an enrollment that is not withdrawn', async () => {
    const { service, transition } = make(summary({ status: EnrollmentStatus.ACTIVE }));
    await expect(service.reactivate('e1', {})).rejects.toThrow(BadRequestException);
    expect(transition).not.toHaveBeenCalled();
  });

  it('404s an unknown enrollment', async () => {
    const { service } = make(null);
    await expect(service.reactivate('nope', {})).rejects.toThrow(NotFoundException);
  });
});
