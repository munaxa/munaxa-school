import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { ContractStatus, ContractType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ContractAllowanceDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  amount!: number;
}

export class CreateContractDto {
  @ApiProperty({ enum: ContractType })
  @IsEnum(ContractType)
  contractType!: ContractType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiProperty({ description: 'Contract start date (ISO date).' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({ description: 'Contract end date (ISO date); omit for open-ended.' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  baseSalary?: number;

  @ApiPropertyOptional({ default: 'JOD' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @ApiPropertyOptional({ type: [ContractAllowanceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractAllowanceDto)
  allowances?: ContractAllowanceDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  benefits?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  workingHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  vacationDays?: number;

  @ApiPropertyOptional({ description: 'Linked signed-contract document id.' })
  @IsOptional()
  @IsString()
  signedDocumentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

/** Update may also change status (activate/expire/terminate). */
export class UpdateContractDto extends PartialType(CreateContractDto) {
  @ApiPropertyOptional({ enum: ContractStatus })
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;
}

/** Renew a contract: creates a new contract linked to the previous one, which is marked RENEWED. */
export class RenewContractDto extends OmitType(CreateContractDto, [] as const) {}
