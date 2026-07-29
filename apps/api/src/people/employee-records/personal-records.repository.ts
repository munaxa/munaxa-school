import { Injectable } from '@nestjs/common';
import type {
  Certificate,
  Dependent,
  EmergencyContact,
  EmployeeBankAccount,
  EmployeeEducation,
  Prisma,
} from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

/**
 * One repository for the five simple, employee-scoped personal sub-records (emergency contacts,
 * dependents, education, certificates, bank accounts). They share the same tenant-scoped +
 * audited CRUD shape, so they live together to avoid five near-identical repositories.
 */
@Injectable()
export class PersonalRecordsRepository extends TenantRepository {
  employeeExists(employeeId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.employee.findFirst({ where: { id: employeeId, deletedAt: null } })) !== null,
    );
  }

  // ----- Emergency contacts -------------------------------------------------
  createEmergencyContact(
    employeeId: string,
    data: Omit<Prisma.EmergencyContactUncheckedCreateInput, 'tenantId' | 'employeeId'>,
  ): Promise<EmergencyContact> {
    return this.run(async (tx, tenantId) => {
      const row = await tx.emergencyContact.create({ data: { ...data, tenantId, employeeId } });
      await this.writeAudit(tx, tenantId, {
        action: 'emergency_contact.create',
        entityType: 'EmergencyContact',
        entityId: row.id,
        metadata: { employeeId },
      });
      return row;
    });
  }
  listEmergencyContacts(employeeId: string): Promise<EmergencyContact[]> {
    return this.run((tx) =>
      tx.emergencyContact.findMany({ where: { employeeId }, orderBy: { createdAt: 'asc' } }),
    );
  }
  findEmergencyContact(id: string): Promise<EmergencyContact | null> {
    return this.run((tx) => tx.emergencyContact.findFirst({ where: { id } }));
  }
  updateEmergencyContact(
    id: string,
    data: Prisma.EmergencyContactUncheckedUpdateInput,
  ): Promise<EmergencyContact> {
    return this.run(async (tx, tenantId) => {
      const row = await tx.emergencyContact.update({ where: { id }, data });
      await this.writeAudit(tx, tenantId, {
        action: 'emergency_contact.update',
        entityType: 'EmergencyContact',
        entityId: id,
      });
      return row;
    });
  }
  deleteEmergencyContact(id: string): Promise<EmergencyContact> {
    return this.run(async (tx, tenantId) => {
      await this.writeAudit(tx, tenantId, {
        action: 'emergency_contact.delete',
        entityType: 'EmergencyContact',
        entityId: id,
      });
      return tx.emergencyContact.delete({ where: { id } });
    });
  }

  // ----- Dependents ---------------------------------------------------------
  createDependent(
    employeeId: string,
    data: Omit<Prisma.DependentUncheckedCreateInput, 'tenantId' | 'employeeId'>,
  ): Promise<Dependent> {
    return this.run(async (tx, tenantId) => {
      const row = await tx.dependent.create({ data: { ...data, tenantId, employeeId } });
      await this.writeAudit(tx, tenantId, {
        action: 'dependent.create',
        entityType: 'Dependent',
        entityId: row.id,
        metadata: { employeeId },
      });
      return row;
    });
  }
  listDependents(employeeId: string): Promise<Dependent[]> {
    return this.run((tx) =>
      tx.dependent.findMany({ where: { employeeId }, orderBy: { createdAt: 'asc' } }),
    );
  }
  findDependent(id: string): Promise<Dependent | null> {
    return this.run((tx) => tx.dependent.findFirst({ where: { id } }));
  }
  updateDependent(id: string, data: Prisma.DependentUncheckedUpdateInput): Promise<Dependent> {
    return this.run(async (tx, tenantId) => {
      const row = await tx.dependent.update({ where: { id }, data });
      await this.writeAudit(tx, tenantId, {
        action: 'dependent.update',
        entityType: 'Dependent',
        entityId: id,
      });
      return row;
    });
  }
  deleteDependent(id: string): Promise<Dependent> {
    return this.run(async (tx, tenantId) => {
      await this.writeAudit(tx, tenantId, {
        action: 'dependent.delete',
        entityType: 'Dependent',
        entityId: id,
      });
      return tx.dependent.delete({ where: { id } });
    });
  }

  // ----- Education ----------------------------------------------------------
  createEducation(
    employeeId: string,
    data: Omit<Prisma.EmployeeEducationUncheckedCreateInput, 'tenantId' | 'employeeId'>,
  ): Promise<EmployeeEducation> {
    return this.run(async (tx, tenantId) => {
      const row = await tx.employeeEducation.create({ data: { ...data, tenantId, employeeId } });
      await this.writeAudit(tx, tenantId, {
        action: 'employee_education.create',
        entityType: 'EmployeeEducation',
        entityId: row.id,
        metadata: { employeeId },
      });
      return row;
    });
  }
  listEducation(employeeId: string): Promise<EmployeeEducation[]> {
    return this.run((tx) =>
      tx.employeeEducation.findMany({ where: { employeeId }, orderBy: { endYear: 'desc' } }),
    );
  }
  findEducation(id: string): Promise<EmployeeEducation | null> {
    return this.run((tx) => tx.employeeEducation.findFirst({ where: { id } }));
  }
  updateEducation(
    id: string,
    data: Prisma.EmployeeEducationUncheckedUpdateInput,
  ): Promise<EmployeeEducation> {
    return this.run(async (tx, tenantId) => {
      const row = await tx.employeeEducation.update({ where: { id }, data });
      await this.writeAudit(tx, tenantId, {
        action: 'employee_education.update',
        entityType: 'EmployeeEducation',
        entityId: id,
      });
      return row;
    });
  }
  deleteEducation(id: string): Promise<EmployeeEducation> {
    return this.run(async (tx, tenantId) => {
      await this.writeAudit(tx, tenantId, {
        action: 'employee_education.delete',
        entityType: 'EmployeeEducation',
        entityId: id,
      });
      return tx.employeeEducation.delete({ where: { id } });
    });
  }

  // ----- Certificates -------------------------------------------------------
  createCertificate(
    employeeId: string,
    data: Omit<Prisma.CertificateUncheckedCreateInput, 'tenantId' | 'employeeId'>,
  ): Promise<Certificate> {
    return this.run(async (tx, tenantId) => {
      const row = await tx.certificate.create({ data: { ...data, tenantId, employeeId } });
      await this.writeAudit(tx, tenantId, {
        action: 'certificate.create',
        entityType: 'Certificate',
        entityId: row.id,
        metadata: { employeeId },
      });
      return row;
    });
  }
  listCertificates(employeeId: string): Promise<Certificate[]> {
    return this.run((tx) =>
      tx.certificate.findMany({ where: { employeeId }, orderBy: { issueDate: 'desc' } }),
    );
  }
  findCertificate(id: string): Promise<Certificate | null> {
    return this.run((tx) => tx.certificate.findFirst({ where: { id } }));
  }
  updateCertificate(
    id: string,
    data: Prisma.CertificateUncheckedUpdateInput,
  ): Promise<Certificate> {
    return this.run(async (tx, tenantId) => {
      const row = await tx.certificate.update({ where: { id }, data });
      await this.writeAudit(tx, tenantId, {
        action: 'certificate.update',
        entityType: 'Certificate',
        entityId: id,
      });
      return row;
    });
  }
  deleteCertificate(id: string): Promise<Certificate> {
    return this.run(async (tx, tenantId) => {
      await this.writeAudit(tx, tenantId, {
        action: 'certificate.delete',
        entityType: 'Certificate',
        entityId: id,
      });
      return tx.certificate.delete({ where: { id } });
    });
  }

  // ----- Bank accounts (sensitive) -----------------------------------------
  createBankAccount(
    employeeId: string,
    data: Omit<Prisma.EmployeeBankAccountUncheckedCreateInput, 'tenantId' | 'employeeId'>,
  ): Promise<EmployeeBankAccount> {
    return this.run(async (tx, tenantId) => {
      const row = await tx.employeeBankAccount.create({ data: { ...data, tenantId, employeeId } });
      await this.writeAudit(tx, tenantId, {
        action: 'employee_bank_account.create',
        entityType: 'EmployeeBankAccount',
        entityId: row.id,
        metadata: { employeeId },
      });
      return row;
    });
  }
  listBankAccounts(employeeId: string): Promise<EmployeeBankAccount[]> {
    return this.run((tx) =>
      tx.employeeBankAccount.findMany({ where: { employeeId }, orderBy: { createdAt: 'asc' } }),
    );
  }
  findBankAccount(id: string): Promise<EmployeeBankAccount | null> {
    return this.run((tx) => tx.employeeBankAccount.findFirst({ where: { id } }));
  }
  updateBankAccount(
    id: string,
    data: Prisma.EmployeeBankAccountUncheckedUpdateInput,
  ): Promise<EmployeeBankAccount> {
    return this.run(async (tx, tenantId) => {
      const row = await tx.employeeBankAccount.update({ where: { id }, data });
      await this.writeAudit(tx, tenantId, {
        action: 'employee_bank_account.update',
        entityType: 'EmployeeBankAccount',
        entityId: id,
      });
      return row;
    });
  }
  deleteBankAccount(id: string): Promise<EmployeeBankAccount> {
    return this.run(async (tx, tenantId) => {
      await this.writeAudit(tx, tenantId, {
        action: 'employee_bank_account.delete',
        entityType: 'EmployeeBankAccount',
        entityId: id,
      });
      return tx.employeeBankAccount.delete({ where: { id } });
    });
  }
}
