import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { DocumentService } from './document.service';
import { ConfirmDocumentDto, PresignDocumentDto } from './document.dto';

@ApiTags('parent-portal')
@ApiBearerAuth()
@Controller({ path: 'parent-portal/documents', version: '1' })
@RequirePermissions(Permission.DOCUMENT_MANAGE)
export class DocumentController {
  constructor(private readonly service: DocumentService) {}

  @Post('presign')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get a pre-signed S3 URL to upload a document for a student' })
  presign(@Body() dto: PresignDocumentDto) {
    return this.service.presign(dto);
  }

  @Post()
  @ApiOperation({ summary: 'Confirm an uploaded document into the vault' })
  confirm(@Body() dto: ConfirmDocumentDto) {
    return this.service.confirm(dto);
  }

  @Get()
  @ApiQuery({ name: 'studentId', required: false })
  @ApiOperation({ summary: 'List vault documents (with download URLs)' })
  list(@Query('studentId') studentId?: string) {
    return this.service.list(studentId);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Get a fresh pre-signed download URL for a document' })
  download(@Param('id') id: string) {
    return this.service.download(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a document from the vault' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
