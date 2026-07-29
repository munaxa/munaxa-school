import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { REPORT_FORMATS, type ReportFormat } from '../../reporting/export/report.types';

export class AlertsQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 365, default: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  within?: number;
}

export class RosterExportQueryDto {
  @ApiPropertyOptional({ enum: REPORT_FORMATS, default: 'csv' })
  @IsOptional()
  @IsIn(REPORT_FORMATS)
  format?: ReportFormat;
}
