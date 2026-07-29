import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantDbStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class StartPromotionDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The school (tenant) to promote to its own database',
  })
  @IsUUID()
  tenantId!: string;

  @ApiPropertyOptional({
    description: 'Reference/key for the target DB secret (not the URL itself)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  connectionRef?: string;

  @ApiPropertyOptional({ example: 'school-a / on-prem Amman' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  hostLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Advance the wizard to the next state (or to a terminal state). */
export class AdvancePromotionDto {
  @ApiProperty({ enum: TenantDbStatus })
  @IsEnum(TenantDbStatus)
  to!: TenantDbStatus;

  @ApiPropertyOptional({ description: 'Operator note or, for FAILED, the error detail' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
