import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CardsService } from './cards.service';
import { IssueCardDto, UpdateCardDto } from './cards.dto';

/**
 * Student NFC/RFID card registry (Phase 22). Admin/office staff issue, relabel, suspend, mark
 * stolen/lost/revoked, or delete cards. Only ACTIVE cards resolve during NFC/RFID identification.
 */
@ApiTags('cards')
@ApiBearerAuth()
@Controller({ path: 'cards', version: '1' })
export class CardsController {
  constructor(private readonly service: CardsService) {}

  @Post()
  @RequirePermissions(Permission.CARD_MANAGE)
  @ApiOperation({ summary: 'Issue a card to a student' })
  issue(@Body() dto: IssueCardDto) {
    return this.service.issue(dto);
  }

  @Get()
  @RequirePermissions(Permission.CARD_READ)
  @ApiQuery({ name: 'studentId', required: false })
  list(@Query('studentId') studentId?: string) {
    return this.service.list(studentId);
  }

  @Get(':id')
  @RequirePermissions(Permission.CARD_READ)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CARD_MANAGE)
  @ApiOperation({
    summary: 'Update a card status (suspend / stolen / lost / revoke / reactivate) or label',
  })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCardDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.CARD_MANAGE)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
