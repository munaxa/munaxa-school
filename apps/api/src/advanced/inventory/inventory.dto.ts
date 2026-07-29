import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryTxnType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateInventoryItemDto {
  @ApiProperty({ example: 'A4 Paper Ream' })
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional({ example: 'ream' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  unit?: string;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;
}

export class InventoryTxnDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  itemId!: string;

  @ApiProperty({ enum: InventoryTxnType })
  @IsEnum(InventoryTxnType)
  type!: InventoryTxnType;

  @ApiProperty({ example: 10, description: 'Units in (IN), out (OUT), or the new count (ADJUST)' })
  @IsInt()
  @Min(0)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  reason?: string;
}
