import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class UpsertRamadanConfigDto {
  @ApiProperty({ description: 'Enable the Ramadan schedule for the campus' })
  @IsBoolean()
  ramadanModeEnabled!: boolean;

  @ApiPropertyOptional({ example: '2026-02-18' })
  @IsOptional()
  @IsDateString()
  ramadanStartDate?: string;

  @ApiPropertyOptional({ example: '2026-03-19' })
  @IsOptional()
  @IsDateString()
  ramadanEndDate?: string;
}
