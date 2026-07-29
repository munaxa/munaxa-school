import { NotFoundException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import type { OrganizationsRepository } from './organizations.repository';

function svc(getResult: unknown) {
  const repo = {
    get: jest.fn().mockResolvedValue(getResult),
    list: jest.fn(),
  } as unknown as OrganizationsRepository;
  return new OrganizationsService(repo);
}

describe('OrganizationsService.get', () => {
  it('throws when the organization is missing', async () => {
    await expect(svc(null).get('x')).rejects.toThrow(NotFoundException);
  });

  it('rolls up MRR (active subs only) and usage across member schools', async () => {
    const org = {
      id: 'o1',
      name: 'Group',
      slug: 'group',
      billingEmail: null,
      countryCode: 'JO',
      consolidatedBilling: true,
      isArchived: false,
      createdAt: new Date('2026-01-01'),
      tenants: [
        {
          id: 't1',
          name: 'A',
          slug: 'a',
          status: 'ACTIVE',
          subscription: {
            status: 'ACTIVE',
            billingCycle: 'MONTHLY',
            plan: { name: 'Professional', priceMonthly: 14900, priceYearly: 149000 },
          },
          subscriptionUsages: [{ metric: 'students', value: 120 }],
          _count: { students: 120, campuses: 2 },
        },
        {
          id: 't2',
          name: 'B',
          slug: 'b',
          status: 'ACTIVE',
          subscription: {
            status: 'YEARLY_BILLED_ACTIVE_PLACEHOLDER',
            billingCycle: 'YEARLY',
            plan: { name: 'Enterprise', priceMonthly: null, priceYearly: 240000 },
          },
          subscriptionUsages: [{ metric: 'students', value: 30 }],
          _count: { students: 30, campuses: 1 },
        },
        {
          id: 't3',
          name: 'C (cancelled)',
          slug: 'c',
          status: 'CANCELLED',
          subscription: {
            status: 'CANCELLED',
            billingCycle: 'MONTHLY',
            plan: { name: 'Starter', priceMonthly: 4900, priceYearly: 49000 },
          },
          subscriptionUsages: [{ metric: 'students', value: 5 }],
          _count: { students: 5, campuses: 1 },
        },
      ],
    };
    const result = await svc(org).get('o1');
    // Only the ACTIVE monthly sub contributes (t2 has a non-active status; t3 cancelled).
    expect(result.billingSummary.estimatedMrr).toBe(14900);
    expect(result.billingSummary.schoolCount).toBe(3);
    expect(result.usageSummary).toEqual({ students: 155 });
    expect(result.schools).toHaveLength(3);
  });
});
