import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnnouncementAudience } from '@prisma/client';
import { IsEnum, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

export class CreateAnnouncementDto {
  @ApiProperty({ example: 'Parent-Teacher Meeting' })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  body!: string;

  @ApiProperty({ enum: AnnouncementAudience, default: AnnouncementAudience.ALL })
  @IsEnum(AnnouncementAudience)
  audience!: AnnouncementAudience;

  @ApiPropertyOptional({ format: 'uuid', description: 'Required when audience = SECTION' })
  @ValidateIf((o: CreateAnnouncementDto) => o.audience === AnnouncementAudience.SECTION)
  @IsUUID()
  sectionId?: string;
}
