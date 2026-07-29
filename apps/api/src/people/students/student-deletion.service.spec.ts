import { BadRequestException } from '@nestjs/common';
import type { Student } from '@prisma/client';
import { StudentService } from './student.service';
import type { StudentRepository } from './student.repository';
import type { AccountRepository } from '../../finance/account/account.repository';
import type { SubscriptionService } from '../../subscription/subscription.service';
import type { DomainEvents } from '../../events/domain-events';

function setup(blockers: string[]) {
  const findById = jest
    .fn<Promise<Student | null>, [string]>()
    .mockResolvedValue({ id: 's1' } as Student);
  const deletionBlockers = jest.fn<Promise<string[]>, [string]>().mockResolvedValue(blockers);
  const softDelete = jest.fn().mockResolvedValue({});
  const repo = { findById, deletionBlockers, softDelete } as unknown as StudentRepository;
  const accounts = {} as unknown as AccountRepository;
  const subscriptions = {} as unknown as SubscriptionService;
  const events = { emit: jest.fn() } as unknown as DomainEvents;
  return {
    service: new StudentService(repo, accounts, subscriptions, events),
    deletionBlockers,
    softDelete,
  };
}

describe('StudentService — deletion guard (delete only a draft student with no dependents)', () => {
  it('soft-deletes when there are no dependent records', async () => {
    const { service, softDelete } = setup([]);
    await service.remove('s1');
    expect(softDelete).toHaveBeenCalledWith('s1');
  });

  it('refuses deletion and names the blockers when dependents exist', async () => {
    const { service, softDelete } = setup(['enrollments', 'finance']);
    await expect(service.remove('s1')).rejects.toThrow(BadRequestException);
    expect(softDelete).not.toHaveBeenCalled();
  });

  it('deletability() reports deletable=false with the blockers', async () => {
    const { service } = setup(['attendance']);
    await expect(service.deletability('s1')).resolves.toEqual({
      deletable: false,
      blockers: ['attendance'],
    });
  });

  it('deletability() reports deletable=true when clean', async () => {
    const { service } = setup([]);
    await expect(service.deletability('s1')).resolves.toEqual({ deletable: true, blockers: [] });
  });
});
