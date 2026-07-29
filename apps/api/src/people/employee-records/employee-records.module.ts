import { Module } from '@nestjs/common';
import { StorageService } from '../../common/storage.service';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
import { ContractRepository } from './contract.repository';
import { EmployeeDocumentController } from './document.controller';
import { EmployeeDocumentService } from './document.service';
import { EmployeeDocumentRepository } from './document.repository';
import { PersonalRecordsService } from './personal-records.service';
import { PersonalRecordsRepository } from './personal-records.repository';
import {
  BankAccountController,
  CertificateController,
  DependentController,
  EducationController,
  EmergencyContactController,
} from './personal-records.controller';
import { DriverController, DriverProfileController } from './driver.controller';
import { DriverService } from './driver.service';
import { DriverRepository } from './driver.repository';

/**
 * HR Phase 2 — employment contracts, employee documents (S3-backed, versioned), and the personal
 * sub-records (emergency contacts, dependents, education, certificates, bank accounts). All routes
 * are nested under `/employees/:employeeId/…` and tenant-scoped via RLS.
 */
@Module({
  controllers: [
    ContractController,
    EmployeeDocumentController,
    EmergencyContactController,
    DependentController,
    EducationController,
    CertificateController,
    BankAccountController,
    DriverController,
    DriverProfileController,
  ],
  providers: [
    ContractService,
    ContractRepository,
    EmployeeDocumentService,
    EmployeeDocumentRepository,
    PersonalRecordsService,
    PersonalRecordsRepository,
    DriverService,
    DriverRepository,
    StorageService,
  ],
})
export class EmployeeRecordsModule {}
