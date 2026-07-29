import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { EmployeeDocumentService } from './document.service';
import { CreateDocumentDto, PresignDocumentDto } from './document.dto';

@ApiTags('hr-documents')
@ApiBearerAuth()
@Controller({ path: 'employees/:employeeId/documents', version: '1' })
export class EmployeeDocumentController {
  constructor(private readonly service: EmployeeDocumentService) {}

  @Post('presign')
  @RequirePermissions(Permission.HR_DOCUMENT_MANAGE)
  presign(@Param('employeeId', ParseUUIDPipe) employeeId: string, @Body() dto: PresignDocumentDto) {
    return this.service.presign(employeeId, dto);
  }

  @Post()
  @RequirePermissions(Permission.HR_DOCUMENT_MANAGE)
  create(@Param('employeeId', ParseUUIDPipe) employeeId: string, @Body() dto: CreateDocumentDto) {
    return this.service.create(employeeId, dto);
  }

  @Get()
  @RequirePermissions(Permission.HR_DOCUMENT_READ)
  list(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.service.list(employeeId);
  }

  @Get(':id/download')
  @RequirePermissions(Permission.HR_DOCUMENT_READ)
  download(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.downloadUrl(employeeId, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.HR_DOCUMENT_MANAGE)
  remove(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(employeeId, id);
  }
}
