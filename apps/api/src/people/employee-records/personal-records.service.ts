import { Injectable, NotFoundException } from '@nestjs/common';
import { PersonalRecordsRepository } from './personal-records.repository';
import type {
  CreateBankAccountDto,
  CreateCertificateDto,
  CreateDependentDto,
  CreateEducationDto,
  CreateEmergencyContactDto,
  UpdateBankAccountDto,
  UpdateCertificateDto,
  UpdateDependentDto,
  UpdateEducationDto,
  UpdateEmergencyContactDto,
} from './personal-records.dto';

const d = (v?: string) => (v ? new Date(v) : undefined);

@Injectable()
export class PersonalRecordsService {
  constructor(private readonly repo: PersonalRecordsRepository) {}

  private async assertEmployee(employeeId: string) {
    if (!(await this.repo.employeeExists(employeeId))) {
      throw new NotFoundException('Employee not found');
    }
  }

  private own<T extends { employeeId: string }>(row: T | null, employeeId: string): T {
    if (!row || row.employeeId !== employeeId) throw new NotFoundException('Record not found');
    return row;
  }

  // ----- Emergency contacts -------------------------------------------------
  async listEmergencyContacts(employeeId: string) {
    await this.assertEmployee(employeeId);
    return this.repo.listEmergencyContacts(employeeId);
  }
  async createEmergencyContact(employeeId: string, dto: CreateEmergencyContactDto) {
    await this.assertEmployee(employeeId);
    return this.repo.createEmergencyContact(employeeId, { ...dto });
  }
  async updateEmergencyContact(employeeId: string, id: string, dto: UpdateEmergencyContactDto) {
    this.own(await this.repo.findEmergencyContact(id), employeeId);
    return this.repo.updateEmergencyContact(id, { ...dto });
  }
  async deleteEmergencyContact(employeeId: string, id: string) {
    this.own(await this.repo.findEmergencyContact(id), employeeId);
    await this.repo.deleteEmergencyContact(id);
  }

  // ----- Dependents ---------------------------------------------------------
  async listDependents(employeeId: string) {
    await this.assertEmployee(employeeId);
    return this.repo.listDependents(employeeId);
  }
  async createDependent(employeeId: string, dto: CreateDependentDto) {
    await this.assertEmployee(employeeId);
    return this.repo.createDependent(employeeId, {
      name: dto.name,
      relation: dto.relation,
      ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
      ...(dto.nationalId !== undefined ? { nationalId: dto.nationalId } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      ...(dto.dateOfBirth !== undefined ? { dateOfBirth: d(dto.dateOfBirth) } : {}),
    });
  }
  async updateDependent(employeeId: string, id: string, dto: UpdateDependentDto) {
    this.own(await this.repo.findDependent(id), employeeId);
    return this.repo.updateDependent(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.relation !== undefined ? { relation: dto.relation } : {}),
      ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
      ...(dto.nationalId !== undefined ? { nationalId: dto.nationalId } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      ...(dto.dateOfBirth !== undefined ? { dateOfBirth: d(dto.dateOfBirth) ?? null } : {}),
    });
  }
  async deleteDependent(employeeId: string, id: string) {
    this.own(await this.repo.findDependent(id), employeeId);
    await this.repo.deleteDependent(id);
  }

  // ----- Education ----------------------------------------------------------
  async listEducation(employeeId: string) {
    await this.assertEmployee(employeeId);
    return this.repo.listEducation(employeeId);
  }
  async createEducation(employeeId: string, dto: CreateEducationDto) {
    await this.assertEmployee(employeeId);
    return this.repo.createEducation(employeeId, { ...dto });
  }
  async updateEducation(employeeId: string, id: string, dto: UpdateEducationDto) {
    this.own(await this.repo.findEducation(id), employeeId);
    return this.repo.updateEducation(id, { ...dto });
  }
  async deleteEducation(employeeId: string, id: string) {
    this.own(await this.repo.findEducation(id), employeeId);
    await this.repo.deleteEducation(id);
  }

  // ----- Certificates -------------------------------------------------------
  async listCertificates(employeeId: string) {
    await this.assertEmployee(employeeId);
    return this.repo.listCertificates(employeeId);
  }
  async createCertificate(employeeId: string, dto: CreateCertificateDto) {
    await this.assertEmployee(employeeId);
    return this.repo.createCertificate(employeeId, {
      name: dto.name,
      ...(dto.issuingBody !== undefined ? { issuingBody: dto.issuingBody } : {}),
      ...(dto.credentialId !== undefined ? { credentialId: dto.credentialId } : {}),
      ...(dto.documentId !== undefined ? { documentId: dto.documentId } : {}),
      ...(dto.issueDate !== undefined ? { issueDate: d(dto.issueDate) } : {}),
      ...(dto.expiryDate !== undefined ? { expiryDate: d(dto.expiryDate) } : {}),
    });
  }
  async updateCertificate(employeeId: string, id: string, dto: UpdateCertificateDto) {
    this.own(await this.repo.findCertificate(id), employeeId);
    return this.repo.updateCertificate(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.issuingBody !== undefined ? { issuingBody: dto.issuingBody } : {}),
      ...(dto.credentialId !== undefined ? { credentialId: dto.credentialId } : {}),
      ...(dto.documentId !== undefined ? { documentId: dto.documentId } : {}),
      ...(dto.issueDate !== undefined ? { issueDate: d(dto.issueDate) ?? null } : {}),
      ...(dto.expiryDate !== undefined ? { expiryDate: d(dto.expiryDate) ?? null } : {}),
    });
  }
  async deleteCertificate(employeeId: string, id: string) {
    this.own(await this.repo.findCertificate(id), employeeId);
    await this.repo.deleteCertificate(id);
  }

  // ----- Bank accounts ------------------------------------------------------
  async listBankAccounts(employeeId: string) {
    await this.assertEmployee(employeeId);
    return this.repo.listBankAccounts(employeeId);
  }
  async createBankAccount(employeeId: string, dto: CreateBankAccountDto) {
    await this.assertEmployee(employeeId);
    return this.repo.createBankAccount(employeeId, { ...dto });
  }
  async updateBankAccount(employeeId: string, id: string, dto: UpdateBankAccountDto) {
    this.own(await this.repo.findBankAccount(id), employeeId);
    return this.repo.updateBankAccount(id, { ...dto });
  }
  async deleteBankAccount(employeeId: string, id: string) {
    this.own(await this.repo.findBankAccount(id), employeeId);
    await this.repo.deleteBankAccount(id);
  }
}
