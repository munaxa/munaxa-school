import { Module } from '@nestjs/common';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { ReportingRepository } from './reporting.repository';
import { ExportService } from './export/export.service';

/**
 * Reporting (Phase 13): read-model aggregations over existing domains (attendance, academics,
 * finance, behavior) exposed as JSON for viewing and as CSV / Excel (exceljs) / PDF (pdfkit)
 * downloads. No new persistence — every query runs under tenant RLS via {@link ReportingRepository}.
 */
@Module({
  controllers: [ReportingController],
  providers: [ReportingService, ReportingRepository, ExportService],
  // ExportService is a self-contained tabular renderer (csv/xlsx/pdf) reused by HR payroll-prep.
  exports: [ExportService],
})
export class ReportingModule {}
