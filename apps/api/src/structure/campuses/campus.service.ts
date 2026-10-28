import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Campus } from '@prisma/client';
import { LimitKey } from '@school/domain';
import { CampusRepository } from './campus.repository';
import { requireTenantId } from '../../common/tenant.util';
import { DomainEvents } from '../../events/domain-events';
import { SubscriptionService } from '../../subscription/subscription.service';
import type { CreateCampusDto, UpdateCampusDto } from './campus.dto';

@Injectable()
export class CampusService {
  constructor(
    private readonly repo: CampusRepository,
    private readonly subscriptions: SubscriptionService,
    private readonly events: DomainEvents,
  ) {}

  async create(dto: CreateCampusDto): Promise<Campus> {
    if (!(await this.repo.schoolExists(dto.schoolId))) {
      throw new BadRequestException('School not found in this tenant');
    }
    // The plan's campus limit, counted and enforced in the same locked transaction as the create.
    const tenantId = requireTenantId();
    const capacity = await this.subscriptions.capacity(tenantId, LimitKey.CAMPUSES);
    const { campus, total } = await this.repo.createWithinCapacity(dto, capacity);
    this.events.emit({ type: 'CampusCreated', tenantId, total });
    return campus;
  }

  list(schoolId?: string): Promise<Campus[]> {
    return this.repo.findMany(schoolId);
  }

  async get(id: string): Promise<Campus> {
    const campus = await this.repo.findById(id);
    if (!campus) throw new NotFoundException('Campus not found');
    return campus;
  }

  async update(id: string, dto: UpdateCampusDto): Promise<Campus> {
    await this.get(id);
    if (dto.schoolId && !(await this.repo.schoolExists(dto.schoolId))) {
      throw new BadRequestException('School not found in this tenant');
    }
    return this.repo.update(id, dto);
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    const total = await this.repo.softDelete(id);
    this.events.emit({ type: 'CampusDeleted', tenantId: requireTenantId(), total });
  }
}
