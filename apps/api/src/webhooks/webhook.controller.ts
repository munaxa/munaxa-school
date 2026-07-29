import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { WebhookService } from './webhook.service';

class CreateWebhookDto {
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  url!: string;

  @IsOptional() @IsString() @MaxLength(200) description?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  eventTypes?: string[];

  @IsOptional() @IsString() @MaxLength(200) secret?: string;
  @IsOptional() @IsUUID() tenantId?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

/** Platform Console — outbound webhook endpoint management. */
@ApiTags('platform-webhooks')
@ApiBearerAuth()
@Controller({ path: 'platform/console/webhooks', version: '1' })
export class WebhookController {
  constructor(private readonly service: WebhookService) {}

  @Get()
  @RequirePermissions(Permission.PLATFORM_FEATUREFLAG_MANAGE)
  @ApiOperation({ summary: 'List webhook endpoints' })
  list() {
    return this.service.listEndpoints();
  }

  @Post()
  @RequirePermissions(Permission.PLATFORM_FEATUREFLAG_MANAGE)
  @ApiOperation({ summary: 'Register a webhook endpoint (tenantId omitted = platform-global)' })
  create(@Body() dto: CreateWebhookDto) {
    return this.service.createEndpoint({
      url: dto.url,
      description: dto.description ?? null,
      eventTypes: dto.eventTypes ?? [],
      secret: dto.secret ?? null,
      tenantId: dto.tenantId ?? null,
      isActive: dto.isActive ?? true,
    });
  }

  @Post(':id/disable')
  @RequirePermissions(Permission.PLATFORM_FEATUREFLAG_MANAGE)
  @ApiOperation({ summary: 'Disable an endpoint' })
  disable(@Param('id') id: string) {
    return this.service.setEndpointActive(id, false);
  }

  @Post(':id/enable')
  @RequirePermissions(Permission.PLATFORM_FEATUREFLAG_MANAGE)
  @ApiOperation({ summary: 'Enable an endpoint' })
  enable(@Param('id') id: string) {
    return this.service.setEndpointActive(id, true);
  }

  @Post(':id/rotate-secret')
  @RequirePermissions(Permission.PLATFORM_FEATUREFLAG_MANAGE)
  @ApiOperation({ summary: 'Rotate the signing secret' })
  rotate(@Param('id') id: string) {
    return this.service.rotateSecret(id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.PLATFORM_FEATUREFLAG_MANAGE)
  @ApiOperation({ summary: 'Delete a webhook endpoint' })
  remove(@Param('id') id: string) {
    return this.service.deleteEndpoint(id);
  }

  @Get(':id/deliveries')
  @RequirePermissions(Permission.PLATFORM_FEATUREFLAG_MANAGE)
  @ApiOperation({ summary: 'Recent delivery attempts (optionally only failed)' })
  deliveries(@Param('id') id: string, @Query('failed') failed?: string) {
    return this.service.listDeliveries(id, failed === 'true');
  }

  @Post('deliveries/:deliveryId/retry')
  @RequirePermissions(Permission.PLATFORM_FEATUREFLAG_MANAGE)
  @ApiOperation({ summary: 'Retry a failed delivery' })
  retry(@Param('deliveryId') deliveryId: string) {
    return this.service.retryDelivery(deliveryId);
  }
}
