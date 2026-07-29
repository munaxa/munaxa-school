import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBusRouteDto {
  @ApiProperty({ example: 'North Amman Route' })
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Academic year this route belongs to.' })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiPropertyOptional({ example: '07:00', description: '1st round trip time (HH:MM).' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  round1Time?: string;

  @ApiPropertyOptional({ example: '13:30', description: '2nd round trip time (HH:MM).' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  round2Time?: string;
}

export class UpdateBusRouteDto extends PartialType(CreateBusRouteDto) {
  @ApiPropertyOptional({
    description: 'Disable (true) or re-enable (false) the route. Disabled routes stay listed.',
  })
  @IsOptional()
  @IsBoolean()
  disabled?: boolean;
}

export class CreateBusDto {
  @ApiProperty({ example: '21-12345' })
  @IsString()
  @MaxLength(40)
  plateNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  routeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  capacity?: number;

  @ApiPropertyOptional({ enum: [1, 2], description: 'Trip of the route this bus serves (1 or 2).' })
  @IsOptional()
  @IsInt()
  @IsIn([1, 2])
  tripRound?: number;

  @ApiPropertyOptional({ description: 'Assigned driver — an Employee with a driver profile.' })
  @IsOptional()
  @IsUUID()
  driverId?: string;
}

export class UpdateBusDto extends PartialType(CreateBusDto) {}

export class UpdateBusLocationDto {
  @ApiProperty({ example: 31.9539 })
  @IsLatitude()
  lat!: number;

  @ApiProperty({ example: 35.9106 })
  @IsLongitude()
  lng!: number;
}

export class CreateBusStopDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  routeId!: string;

  @ApiProperty({ example: 'Sweifieh Square' })
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sequence?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ example: '07:15' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  pickupTime?: string;
}

export class AssignStudentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  studentId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  routeId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  stopId?: string;

  @ApiPropertyOptional({
    enum: [1, 2, 3],
    description: 'Trip of the route the student rides: 1 (1st), 2 (2nd), or 3 (both).',
  })
  @IsOptional()
  @IsInt()
  @IsIn([1, 2, 3])
  tripRound?: number;
}
