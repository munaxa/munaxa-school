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
import { ContractService } from './contract.service';
import { CreateContractDto, RenewContractDto, UpdateContractDto } from './contract.dto';

@ApiTags('hr-contracts')
@ApiBearerAuth()
@Controller({ path: 'employees/:employeeId/contracts', version: '1' })
export class ContractController {
  constructor(private readonly service: ContractService) {}

  @Post()
  @RequirePermissions(Permission.HR_CONTRACT_MANAGE)
  create(@Param('employeeId', ParseUUIDPipe) employeeId: string, @Body() dto: CreateContractDto) {
    return this.service.create(employeeId, dto);
  }

  @Get()
  @RequirePermissions(Permission.HR_CONTRACT_READ)
  list(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.service.list(employeeId);
  }

  @Get(':id')
  @RequirePermissions(Permission.HR_CONTRACT_READ)
  get(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.get(employeeId, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.HR_CONTRACT_MANAGE)
  update(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContractDto,
  ) {
    return this.service.update(employeeId, id, dto);
  }

  @Post(':id/renew')
  @RequirePermissions(Permission.HR_CONTRACT_MANAGE)
  renew(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenewContractDto,
  ) {
    return this.service.renew(employeeId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.HR_CONTRACT_MANAGE)
  remove(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(employeeId, id);
  }
}
