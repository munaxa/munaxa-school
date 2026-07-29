import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { REPORT_FORMATS, type ReportFormat } from './export/report.types';

export class ReportQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Restrict to one section' })
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'Range start (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-06-30', description: 'Range end (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Academic report: restrict to a semester' })
  @IsOptional()
  @IsUUID()
  semesterId?: string;
}

export class ExportQueryDto extends ReportQueryDto {
  @ApiPropertyOptional({ enum: REPORT_FORMATS, default: 'csv' })
  @IsOptional()
  @IsIn(REPORT_FORMATS)
  format?: ReportFormat;
}
