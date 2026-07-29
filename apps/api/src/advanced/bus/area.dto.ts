import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateAreaDto {
  @ApiProperty({ example: 'Khalda' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ description: 'The route that serves this area (Area → Route mapping).' })
  @IsOptional()
  @IsUUID()
  routeId?: string;

  @ApiPropertyOptional({ description: 'Academic year the route mapping reflects (optional).' })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiPropertyOptional({
    description: "Optional fee override (JOD). When unset, the route's TransportFare applies.",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  transportFee?: number;

  @ApiPropertyOptional({
    default: true,
    description: 'Whether transport can be requested for this area (shown in registration).',
  })
  @IsOptional()
  @IsBoolean()
  transportationAvailable?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateAreaDto extends PartialType(CreateAreaDto) {}
