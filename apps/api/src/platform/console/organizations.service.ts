import { Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationsRepository } from './organizations.repository';
import type { CreateOrganizationDto, UpdateOrganizationDto } from './organizations.dto';

/** Organization (school-group) management. Read-model shaping + orchestration over the repository. */
@Injectable()
export class OrganizationsService {
  constructor(private readonly repo: OrganizationsRepository) {}

  async list(includeArchived = false) {
    const rows = await this.repo.list(includeArchived);
    return rows.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      billingEmail: o.billingEmail,
      countryCode: o.countryCode,
      consolidatedBilling: o.consolidatedBilling,
      isArchived: o.isArchived,
      schools: o._count.tenants,
      createdAt: o.createdAt.toISOString(),
    }));
  }

  async get(id: string) {
    const o = await this.repo.get(id);
    if (!o) throw new NotFoundException('Organization not found');

    // Billing + usage summaries rolled up across member schools.
    let mrrPlans = 0;
    const usageTotals = new Map<string, number>();
    const schools = o.tenants.map((t) => {
      for (const u of t.subscriptionUsages) {
        usageTotals.set(u.metric, (usageTotals.get(u.metric) ?? 0) + u.value);
      }
      if (
        t.subscription &&
        ['ACTIVE', 'PAST_DUE', 'GRACE_PERIOD'].includes(t.subscription.status)
      ) {
        const cycle = t.subscription.billingCycle;
        const monthly =
          cycle === 'YEARLY'
            ? Math.round((t.subscription.plan.priceYearly ?? 0) / 12)
            : (t.subscription.plan.priceMonthly ?? 0);
        mrrPlans += monthly;
      }
      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        plan: t.subscription?.plan.name ?? null,
        subscriptionStatus: t.subscription?.status ?? 'NONE',
        students: t._count.students,
        campuses: t._count.campuses,
      };
    });

    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      billingEmail: o.billingEmail,
      countryCode: o.countryCode,
      consolidatedBilling: o.consolidatedBilling,
      isArchived: o.isArchived,
      createdAt: o.createdAt.toISOString(),
      schools,
      billingSummary: { estimatedMrr: mrrPlans, currency: 'JOD', schoolCount: schools.length },
      usageSummary: Object.fromEntries(usageTotals),
    };
  }

  create(dto: CreateOrganizationDto) {
    return this.repo.create({
      name: dto.name,
      slug: dto.slug,
      billingEmail: dto.billingEmail ?? null,
      countryCode: dto.countryCode ?? null,
      consolidatedBilling: dto.consolidatedBilling ?? false,
    });
  }

  update(id: string, dto: UpdateOrganizationDto) {
    return this.repo.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.billingEmail !== undefined ? { billingEmail: dto.billingEmail } : {}),
      ...(dto.countryCode !== undefined ? { countryCode: dto.countryCode } : {}),
      ...(dto.consolidatedBilling !== undefined
        ? { consolidatedBilling: dto.consolidatedBilling }
        : {}),
    });
  }

  archive(id: string) {
    return this.repo.archive(id);
  }

  assignSchool(orgId: string, tenantId: string) {
    return this.repo.assignSchool(orgId, tenantId);
  }

  removeSchool(orgId: string, tenantId: string) {
    return this.repo.removeSchool(orgId, tenantId);
  }

  assignableSchools() {
    return this.repo.assignableSchools();
  }
}
