import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { AssetCategory, AssetCondition, AssetStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAssetDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  assetTag!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ enum: AssetCategory })
  @IsOptional()
  @IsEnum(AssetCategory)
  category?: AssetCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  serialNumber?: string;

  @ApiPropertyOptional({ enum: AssetCondition })
  @IsOptional()
  @IsEnum(AssetCondition)
  condition?: AssetCondition;

  @ApiPropertyOptional({ description: 'Purchase date (ISO date).' })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999)
  purchaseCost?: number;

  @ApiPropertyOptional({ description: 'Warranty expiry (ISO date).' })
  @IsOptional()
  @IsDateString()
  warrantyExpiry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateAssetDto extends PartialType(CreateAssetDto) {
  @ApiPropertyOptional({
    enum: AssetStatus,
    description:
      'Lifecycle status. Assign/return manage AVAILABLE↔ASSIGNED; use this for repair/retire/lost.',
  })
  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;
}

/** Filters for the asset register. */
export class ListAssetsQueryDto {
  @ApiPropertyOptional({ enum: AssetStatus })
  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @ApiPropertyOptional({ enum: AssetCategory })
  @IsOptional()
  @IsEnum(AssetCategory)
  category?: AssetCategory;
}

export class AssignAssetDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiPropertyOptional({ description: 'Return-by date (ISO date).' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ReturnAssetDto {
  @ApiPropertyOptional({ enum: AssetCondition })
  @IsOptional()
  @IsEnum(AssetCondition)
  returnCondition?: AssetCondition;

  @ApiPropertyOptional({
    enum: AssetStatus,
    description:
      'Post-return status (defaults to AVAILABLE; use IN_REPAIR / RETIRED / LOST as needed).',
  })
  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
