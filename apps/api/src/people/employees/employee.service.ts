import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus, type Prisma } from '@prisma/client';
import { Permission } from '@school/domain';
import { TenantContextStore } from '../../prisma/tenant-context';
import {
  EmployeeRepository,
  type EmployeeDetail,
  type EmployeeListRow,
} from './employee.repository';
import type {
  CreateEmployeeDto,
  ListEmployeesQueryDto,
  TransitionEmployeeStatusDto,
  UpdateEmployeeDto,
} from './employee.dto';
import { allowedNextStatuses, canTransition, ENTRY_STATUSES } from './employee-lifecycle.logic';

/** ISO date-string → Date, or undefined when absent. */
function toDate(value: string | undefined): Date | undefined {
  return value ? new Date(value) : undefined;
}

/**
 * Personal fields hidden from callers lacking `hr:sensitive:read`. The record is still returned;
 * these columns are nulled so the Personal-Information tab degrades gracefully by permission.
 */
const SENSITIVE_FIELDS = [
  'nationalId',
  'passportNumber',
  'nationality',
  'visaNumber',
  'visaExpiry',
  'dateOfBirth',
  'maritalStatus',
  'religion',
  'personalEmail',
  'personalPhone',
] as const;

@Injectable()
export class EmployeeService {
  constructor(private readonly repo: EmployeeRepository) {}

  create(dto: CreateEmployeeDto): Promise<EmployeeDetail> {
    const initialStatus = dto.status ?? EmploymentStatus.ACTIVE;
    if (!ENTRY_STATUSES.includes(initialStatus)) {
      throw new BadRequestException(
        `An employee cannot be created at status ${initialStatus}. Allowed: ${ENTRY_STATUSES.join(', ')}.`,
      );
    }
    return this.repo.create(this.toCreateInput(dto), initialStatus);
  }

  async list(query: ListEmployeesQueryDto): Promise<EmployeeListRow[]> {
    const rows = await this.repo.findMany({
      q: query.q,
      status: query.status,
      departmentId: query.departmentId,
      campusId: query.campusId,
      positionId: query.positionId,
      includeInactive: query.includeInactive === 'true',
      take: query.take ?? 200,
      skip: query.skip ?? 0,
    });
    const canReadSensitive = this.canReadSensitive();
    return rows.map((r) => this.redactSensitive(r, canReadSensitive));
  }

  async get(id: string): Promise<EmployeeDetail> {
    const employee = await this.repo.findById(id);
    if (!employee) throw new NotFoundException('Employee not found');
    return this.redactSensitive(employee, this.canReadSensitive());
  }

  /** True when the caller may see sensitive personal data. */
  private canReadSensitive(): boolean {
    return TenantContextStore.get()?.permissions?.includes(Permission.HR_SENSITIVE_READ) ?? false;
  }

  /** Null out sensitive columns unless the caller holds `hr:sensitive:read`. */
  private redactSensitive<T extends Record<string, unknown>>(row: T, canRead: boolean): T {
    if (canRead) return row;
    const clone = { ...row };
    for (const field of SENSITIVE_FIELDS) {
      if (field in clone) (clone as Record<string, unknown>)[field] = null;
    }
    return clone;
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<EmployeeDetail> {
    await this.assertExists(id);
    return this.repo.update(id, this.toUpdateInput(dto));
  }

  /** Perform a lifecycle transition, enforcing the state machine. */
  async transitionStatus(id: string, dto: TransitionEmployeeStatusDto): Promise<EmployeeDetail> {
    const employee = await this.assertExists(id);
    if (!canTransition(employee.status, dto.toStatus)) {
      const allowed = allowedNextStatuses(employee.status);
      throw new BadRequestException(
        allowed.length
          ? `Cannot move ${employee.status} → ${dto.toStatus}. Allowed next: ${allowed.join(', ')}.`
          : `${employee.status} is a terminal status; no further transitions are allowed.`,
      );
    }
    return this.repo.transitionStatus(
      id,
      employee.status,
      dto.toStatus,
      dto.reason,
      toDate(dto.effectiveDate),
    );
  }

  async statusHistory(id: string): Promise<EmployeeDetail['statusHistory']> {
    const employee = await this.get(id);
    return employee.statusHistory;
  }

  async remove(id: string): Promise<void> {
    await this.assertExists(id);
    await this.repo.softDelete(id);
  }

  private async assertExists(id: string) {
    const employee = await this.repo.findBare(id);
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  private toCreateInput(
    dto: CreateEmployeeDto,
  ): Omit<Prisma.EmployeeUncheckedCreateInput, 'tenantId' | 'status'> {
    return {
      firstNameEn: dto.firstNameEn,
      lastNameEn: dto.lastNameEn,
      firstNameAr: dto.firstNameAr,
      lastNameAr: dto.lastNameAr,
      jobTitle: dto.jobTitle,
      ...this.toSharedInput(dto),
    };
  }

  private toUpdateInput(dto: UpdateEmployeeDto): Prisma.EmployeeUncheckedUpdateInput {
    // Unchecked input: foreign keys are set as scalar ids (empty string ⇒ null to clear a link).
    return {
      ...(dto.firstNameEn !== undefined ? { firstNameEn: dto.firstNameEn } : {}),
      ...(dto.lastNameEn !== undefined ? { lastNameEn: dto.lastNameEn } : {}),
      ...(dto.firstNameAr !== undefined ? { firstNameAr: dto.firstNameAr } : {}),
      ...(dto.lastNameAr !== undefined ? { lastNameAr: dto.lastNameAr } : {}),
      ...(dto.jobTitle !== undefined ? { jobTitle: dto.jobTitle } : {}),
      ...this.toSharedInput(dto),
    };
  }

  /** Optional scalar/enum/date/FK fields common to create and update. */
  private toSharedInput(dto: CreateEmployeeDto | UpdateEmployeeDto) {
    return {
      ...(dto.employeeNumber !== undefined ? { employeeNumber: dto.employeeNumber } : {}),
      ...(dto.nationalId !== undefined ? { nationalId: dto.nationalId } : {}),
      ...(dto.passportNumber !== undefined ? { passportNumber: dto.passportNumber } : {}),
      ...(dto.nationality !== undefined ? { nationality: dto.nationality } : {}),
      ...(dto.visaNumber !== undefined ? { visaNumber: dto.visaNumber } : {}),
      ...(dto.visaExpiry !== undefined ? { visaExpiry: toDate(dto.visaExpiry) } : {}),
      ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
      ...(dto.dateOfBirth !== undefined ? { dateOfBirth: toDate(dto.dateOfBirth) } : {}),
      ...(dto.maritalStatus !== undefined ? { maritalStatus: dto.maritalStatus } : {}),
      ...(dto.religion !== undefined ? { religion: dto.religion } : {}),
      ...(dto.personalEmail !== undefined ? { personalEmail: dto.personalEmail } : {}),
      ...(dto.personalPhone !== undefined ? { personalPhone: dto.personalPhone } : {}),
      ...(dto.photoUrl !== undefined ? { photoUrl: dto.photoUrl } : {}),
      ...(dto.employmentType !== undefined ? { employmentType: dto.employmentType } : {}),
      ...(dto.hireDate !== undefined ? { hireDate: toDate(dto.hireDate) } : {}),
      ...(dto.probationEndDate !== undefined
        ? { probationEndDate: toDate(dto.probationEndDate) }
        : {}),
      ...(dto.workingHoursPerWeek !== undefined
        ? { workingHoursPerWeek: dto.workingHoursPerWeek }
        : {}),
      ...(dto.campusId !== undefined ? { campusId: dto.campusId } : {}),
      ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
      ...(dto.positionId !== undefined ? { positionId: dto.positionId } : {}),
      ...(dto.managerId !== undefined ? { managerId: dto.managerId } : {}),
    };
  }
}
