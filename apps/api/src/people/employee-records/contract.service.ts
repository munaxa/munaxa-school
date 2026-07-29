import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContractStatus, Prisma } from '@prisma/client';
import { ContractRepository, type ContractView } from './contract.repository';
import type {
  ContractAllowanceDto,
  CreateContractDto,
  RenewContractDto,
  UpdateContractDto,
} from './contract.dto';

/** Normalise allowance DTOs into a plain JSON array for Prisma's Json column. */
function toJson(allowances: ContractAllowanceDto[]): Prisma.InputJsonValue {
  return allowances.map((a) => ({ name: a.name, amount: a.amount }));
}

@Injectable()
export class ContractService {
  constructor(private readonly repo: ContractRepository) {}

  async create(employeeId: string, dto: CreateContractDto): Promise<ContractView> {
    await this.assertEmployee(employeeId);
    return this.repo.create(employeeId, this.toCreateInput(dto));
  }

  async list(employeeId: string): Promise<ContractView[]> {
    await this.assertEmployee(employeeId);
    return this.repo.listForEmployee(employeeId);
  }

  async get(employeeId: string, id: string): Promise<ContractView> {
    const contract = await this.repo.findById(id);
    if (!contract || contract.employeeId !== employeeId) {
      throw new NotFoundException('Contract not found');
    }
    return contract;
  }

  async update(employeeId: string, id: string, dto: UpdateContractDto): Promise<ContractView> {
    await this.get(employeeId, id);
    const data: Prisma.EmploymentContractUncheckedUpdateInput = { ...this.toUpdateInput(dto) };
    if (dto.status !== undefined) data.status = dto.status;
    return this.repo.update(id, data);
  }

  async renew(employeeId: string, id: string, dto: RenewContractDto): Promise<ContractView> {
    const previous = await this.get(employeeId, id);
    if (previous.status === ContractStatus.RENEWED) {
      throw new BadRequestException('This contract has already been renewed.');
    }
    return this.repo.renew(previous, this.toCreateInput(dto));
  }

  async remove(employeeId: string, id: string): Promise<void> {
    await this.get(employeeId, id);
    await this.repo.softDelete(id);
  }

  private async assertEmployee(employeeId: string) {
    if (!(await this.repo.employeeExists(employeeId))) {
      throw new NotFoundException('Employee not found');
    }
  }

  private toCreateInput(
    dto: CreateContractDto,
  ): Omit<Prisma.EmploymentContractUncheckedCreateInput, 'tenantId' | 'employeeId'> {
    if (dto.endDate && new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException('endDate must be on or after startDate');
    }
    return {
      contractType: dto.contractType,
      startDate: new Date(dto.startDate),
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.endDate !== undefined ? { endDate: new Date(dto.endDate) } : {}),
      ...(dto.baseSalary !== undefined ? { baseSalary: dto.baseSalary } : {}),
      ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
      ...(dto.allowances !== undefined ? { allowances: toJson(dto.allowances) } : {}),
      ...(dto.benefits !== undefined ? { benefits: dto.benefits } : {}),
      ...(dto.workingHours !== undefined ? { workingHours: dto.workingHours } : {}),
      ...(dto.vacationDays !== undefined ? { vacationDays: dto.vacationDays } : {}),
      ...(dto.signedDocumentId !== undefined ? { signedDocumentId: dto.signedDocumentId } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    };
  }

  private toUpdateInput(dto: UpdateContractDto): Prisma.EmploymentContractUncheckedUpdateInput {
    const out: Prisma.EmploymentContractUncheckedUpdateInput = {};
    if (dto.contractType !== undefined) out.contractType = dto.contractType;
    if (dto.title !== undefined) out.title = dto.title;
    if (dto.startDate !== undefined) out.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) out.endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (dto.baseSalary !== undefined) out.baseSalary = dto.baseSalary;
    if (dto.currency !== undefined) out.currency = dto.currency;
    if (dto.allowances !== undefined) out.allowances = toJson(dto.allowances);
    if (dto.benefits !== undefined) out.benefits = dto.benefits;
    if (dto.workingHours !== undefined) out.workingHours = dto.workingHours;
    if (dto.vacationDays !== undefined) out.vacationDays = dto.vacationDays;
    if (dto.signedDocumentId !== undefined) out.signedDocumentId = dto.signedDocumentId;
    if (dto.notes !== undefined) out.notes = dto.notes;
    return out;
  }
}
