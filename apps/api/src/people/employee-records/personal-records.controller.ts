import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { PersonalRecordsService } from './personal-records.service';
import {
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

const P = (id: string) => Param(id, ParseUUIDPipe);

@ApiTags('hr-personal')
@ApiBearerAuth()
@Controller({ path: 'employees/:employeeId/emergency-contacts', version: '1' })
export class EmergencyContactController {
  constructor(private readonly service: PersonalRecordsService) {}

  @Get()
  @RequirePermissions(Permission.EMPLOYEE_READ)
  list(@P('employeeId') employeeId: string) {
    return this.service.listEmergencyContacts(employeeId);
  }
  @Post()
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  create(@P('employeeId') employeeId: string, @Body() dto: CreateEmergencyContactDto) {
    return this.service.createEmergencyContact(employeeId, dto);
  }
  @Patch(':id')
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  update(
    @P('employeeId') employeeId: string,
    @P('id') id: string,
    @Body() dto: UpdateEmergencyContactDto,
  ) {
    return this.service.updateEmergencyContact(employeeId, id, dto);
  }
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  remove(@P('employeeId') employeeId: string, @P('id') id: string) {
    return this.service.deleteEmergencyContact(employeeId, id);
  }
}

@ApiTags('hr-personal')
@ApiBearerAuth()
@Controller({ path: 'employees/:employeeId/dependents', version: '1' })
export class DependentController {
  constructor(private readonly service: PersonalRecordsService) {}

  @Get()
  @RequirePermissions(Permission.EMPLOYEE_READ)
  list(@P('employeeId') employeeId: string) {
    return this.service.listDependents(employeeId);
  }
  @Post()
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  create(@P('employeeId') employeeId: string, @Body() dto: CreateDependentDto) {
    return this.service.createDependent(employeeId, dto);
  }
  @Patch(':id')
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  update(
    @P('employeeId') employeeId: string,
    @P('id') id: string,
    @Body() dto: UpdateDependentDto,
  ) {
    return this.service.updateDependent(employeeId, id, dto);
  }
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  remove(@P('employeeId') employeeId: string, @P('id') id: string) {
    return this.service.deleteDependent(employeeId, id);
  }
}

@ApiTags('hr-personal')
@ApiBearerAuth()
@Controller({ path: 'employees/:employeeId/education', version: '1' })
export class EducationController {
  constructor(private readonly service: PersonalRecordsService) {}

  @Get()
  @RequirePermissions(Permission.EMPLOYEE_READ)
  list(@P('employeeId') employeeId: string) {
    return this.service.listEducation(employeeId);
  }
  @Post()
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  create(@P('employeeId') employeeId: string, @Body() dto: CreateEducationDto) {
    return this.service.createEducation(employeeId, dto);
  }
  @Patch(':id')
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  update(
    @P('employeeId') employeeId: string,
    @P('id') id: string,
    @Body() dto: UpdateEducationDto,
  ) {
    return this.service.updateEducation(employeeId, id, dto);
  }
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  remove(@P('employeeId') employeeId: string, @P('id') id: string) {
    return this.service.deleteEducation(employeeId, id);
  }
}

@ApiTags('hr-personal')
@ApiBearerAuth()
@Controller({ path: 'employees/:employeeId/certificates', version: '1' })
export class CertificateController {
  constructor(private readonly service: PersonalRecordsService) {}

  @Get()
  @RequirePermissions(Permission.EMPLOYEE_READ)
  list(@P('employeeId') employeeId: string) {
    return this.service.listCertificates(employeeId);
  }
  @Post()
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  create(@P('employeeId') employeeId: string, @Body() dto: CreateCertificateDto) {
    return this.service.createCertificate(employeeId, dto);
  }
  @Patch(':id')
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  update(
    @P('employeeId') employeeId: string,
    @P('id') id: string,
    @Body() dto: UpdateCertificateDto,
  ) {
    return this.service.updateCertificate(employeeId, id, dto);
  }
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  remove(@P('employeeId') employeeId: string, @P('id') id: string) {
    return this.service.deleteCertificate(employeeId, id);
  }
}

// Bank details are sensitive: reads require hr:sensitive:read, writes require employee:manage.
@ApiTags('hr-personal')
@ApiBearerAuth()
@Controller({ path: 'employees/:employeeId/bank-accounts', version: '1' })
export class BankAccountController {
  constructor(private readonly service: PersonalRecordsService) {}

  @Get()
  @RequirePermissions(Permission.HR_SENSITIVE_READ)
  list(@P('employeeId') employeeId: string) {
    return this.service.listBankAccounts(employeeId);
  }
  @Post()
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  create(@P('employeeId') employeeId: string, @Body() dto: CreateBankAccountDto) {
    return this.service.createBankAccount(employeeId, dto);
  }
  @Patch(':id')
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  update(
    @P('employeeId') employeeId: string,
    @P('id') id: string,
    @Body() dto: UpdateBankAccountDto,
  ) {
    return this.service.updateBankAccount(employeeId, id, dto);
  }
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  remove(@P('employeeId') employeeId: string, @P('id') id: string) {
    return this.service.deleteBankAccount(employeeId, id);
  }
}
