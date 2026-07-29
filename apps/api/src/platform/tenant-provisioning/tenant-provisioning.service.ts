import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantDbStatus, type TenantDatabase } from '@prisma/client';
import { TenantContextStore } from '../../prisma/tenant-context';
import { TenantProvisioningRepository } from './tenant-provisioning.repository';
import type { AdvancePromotionDto, StartPromotionDto } from './tenant-provisioning.dto';

/** The happy-path order of the promotion wizard. */
export const PROMOTION_STEPS: TenantDbStatus[] = [
  TenantDbStatus.REQUESTED,
  TenantDbStatus.PROVISIONED,
  TenantDbStatus.MIGRATED,
  TenantDbStatus.DATA_COPIED,
  TenantDbStatus.VERIFIED,
  TenantDbStatus.ACTIVE,
];

/** Human guidance shown next to each step in the wizard. */
const STEP_HELP: Record<string, string> = {
  REQUESTED: 'Promotion requested. Record the target database reference and host label.',
  PROVISIONED: 'Create the dedicated database (own/separate/on-prem) and confirm it is reachable.',
  MIGRATED:
    'Apply the schema: pnpm --filter @school/api migrate:tenants (runs migrations + app-role).',
  DATA_COPIED:
    "Move this school's rows from the shared DB into the new database (maintenance window): " +
    'TENANT_ID=… TARGET_DIRECT_URL=… [CREATE_TARGET=1] pnpm --filter @school/api promote:tenant ' +
    '(copies in FK-safe order, idempotent).',
  VERIFIED:
    'The promote:tenant run verifies per-table row counts automatically; also run a smoke test ' +
    'against the new database (login + read) before activating.',
  ACTIVE:
    'Add the connection URL to TENANT_DATABASE_OVERRIDES (secrets) and redeploy to route traffic.',
};

const TERMINAL = new Set<TenantDbStatus>([TenantDbStatus.ACTIVE, TenantDbStatus.ABORTED]);

export interface PromotionView {
  tenantId: string;
  status: TenantDbStatus;
  connectionRef: string | null;
  hostLabel: string | null;
  note: string | null;
  lastError: string | null;
  activatedAt: Date | null;
  updatedAt: Date;
  steps: Array<{ key: TenantDbStatus; help: string; done: boolean; current: boolean }>;
  nextStep: TenantDbStatus | null;
}

@Injectable()
export class TenantProvisioningService {
  constructor(private readonly repo: TenantProvisioningRepository) {}

  async list(): Promise<PromotionView[]> {
    const rows = await this.repo.list();
    return rows.map((r) => this.toView(r));
  }

  async get(tenantId: string): Promise<PromotionView | null> {
    const row = await this.repo.findByTenant(tenantId);
    return row ? this.toView(row) : null;
  }

  /** Begin (or restart) a promotion. Idempotent for in-progress rows; resets terminal-failed ones. */
  async start(dto: StartPromotionDto): Promise<PromotionView> {
    if (!(await this.repo.tenantExists(dto.tenantId))) {
      throw new NotFoundException('Tenant not found');
    }
    const existing = await this.repo.findByTenant(dto.tenantId);
    if (existing) {
      if (existing.status === TenantDbStatus.ACTIVE) {
        throw new ConflictException('Tenant already has a dedicated database');
      }
      const reset =
        existing.status === TenantDbStatus.FAILED || existing.status === TenantDbStatus.ABORTED;
      const updated = await this.repo.update(existing.id, {
        ...(reset ? { status: TenantDbStatus.REQUESTED, lastError: null } : {}),
        ...(dto.connectionRef !== undefined ? { connectionRef: dto.connectionRef } : {}),
        ...(dto.hostLabel !== undefined ? { hostLabel: dto.hostLabel } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
      });
      return this.toView(updated);
    }
    const created = await this.repo.create({
      tenantId: dto.tenantId,
      status: TenantDbStatus.REQUESTED,
      connectionRef: dto.connectionRef ?? null,
      hostLabel: dto.hostLabel ?? null,
      note: dto.note ?? null,
      requestedById: TenantContextStore.get()?.actorUserId ?? null,
    });
    return this.toView(created);
  }

  /** Move the wizard forward one step, or to a terminal state (FAILED/ABORTED). */
  async advance(tenantId: string, dto: AdvancePromotionDto): Promise<PromotionView> {
    const row = await this.repo.findByTenant(tenantId);
    if (!row) throw new NotFoundException('No promotion in progress for this tenant');
    if (TERMINAL.has(row.status)) {
      throw new BadRequestException(`Promotion is already ${row.status}`);
    }

    const { to, note } = dto;

    if (to === TenantDbStatus.ABORTED || to === TenantDbStatus.FAILED) {
      const updated = await this.repo.update(row.id, {
        status: to,
        ...(to === TenantDbStatus.FAILED ? { lastError: note ?? 'Failed' } : {}),
      });
      return this.toView(updated);
    }

    const currentIndex = PROMOTION_STEPS.indexOf(row.status);
    const next = currentIndex >= 0 ? PROMOTION_STEPS[currentIndex + 1] : undefined;
    if (to !== next) {
      throw new BadRequestException(
        `Invalid transition ${row.status} → ${to}. Expected ${next ?? '(none)'}.`,
      );
    }

    const updated = await this.repo.update(row.id, {
      status: to,
      lastError: null,
      ...(note !== undefined ? { note } : {}),
      ...(to === TenantDbStatus.ACTIVE ? { activatedAt: new Date() } : {}),
    });
    return this.toView(updated);
  }

  private toView(row: TenantDatabase): PromotionView {
    const idx = PROMOTION_STEPS.indexOf(row.status);
    const next = idx >= 0 && idx < PROMOTION_STEPS.length - 1 ? PROMOTION_STEPS[idx + 1]! : null;
    return {
      tenantId: row.tenantId,
      status: row.status,
      connectionRef: row.connectionRef,
      hostLabel: row.hostLabel,
      note: row.note,
      lastError: row.lastError,
      activatedAt: row.activatedAt,
      updatedAt: row.updatedAt,
      steps: PROMOTION_STEPS.map((key, i) => ({
        key,
        help: STEP_HELP[key] ?? '',
        done: idx >= 0 && i <= idx,
        current: key === row.status,
      })),
      nextStep: next,
    };
  }
}
