import { BadRequestException, Injectable } from '@nestjs/common';
import { REPORT_FORMATS, type ReportFormat, type ReportTable } from './report.types';

export interface RenderedReport {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

/**
 * Renders a {@link ReportTable} to a downloadable artifact. CSV is built dependency-free;
 * Excel (exceljs) and PDF (pdfkit) are produced via lazily-imported libraries so they only
 * load when an export is actually requested.
 */
@Injectable()
export class ExportService {
  async render(
    table: ReportTable,
    format: ReportFormat,
    baseName: string,
  ): Promise<RenderedReport> {
    if (!REPORT_FORMATS.includes(format)) {
      throw new BadRequestException(`Unsupported format '${format}' (use csv|xlsx|pdf)`);
    }
    const stamp = table.generatedAt.slice(0, 10);
    switch (format) {
      case 'csv':
        return {
          buffer: Buffer.from(this.toCsv(table), 'utf8'),
          contentType: 'text/csv; charset=utf-8',
          filename: `${baseName}-${stamp}.csv`,
        };
      case 'xlsx':
        return {
          buffer: await this.toExcel(table),
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          filename: `${baseName}-${stamp}.xlsx`,
        };
      case 'pdf':
        return {
          buffer: await this.toPdf(table),
          contentType: 'application/pdf',
          filename: `${baseName}-${stamp}.pdf`,
        };
    }
  }

  toCsv(table: ReportTable): string {
    const escape = (v: string | number): string => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = table.columns.map((c) => escape(c.header)).join(',');
    const lines = table.rows.map((row) =>
      table.columns.map((c) => escape(row[c.key] ?? '')).join(','),
    );
    return [header, ...lines].join('\r\n');
  }

  private async toExcel(table: ReportTable): Promise<Buffer> {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date(table.generatedAt);
    const sheet = workbook.addWorksheet(table.title.slice(0, 31) || 'Report');
    sheet.columns = table.columns.map((c) => ({ header: c.header, key: c.key, width: 22 }));
    sheet.getRow(1).font = { bold: true };
    for (const row of table.rows) sheet.addRow(row);
    const out = await workbook.xlsx.writeBuffer();
    return Buffer.from(out);
  }

  private async toPdf(table: ReportTable): Promise<Buffer> {
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];

    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    doc.fontSize(16).text(table.title, { underline: true });
    if (table.subtitle) doc.moveDown(0.3).fontSize(10).fillColor('#555').text(table.subtitle);
    doc.moveDown(0.3).fontSize(8).fillColor('#888').text(`Generated ${table.generatedAt}`);
    doc.moveDown(0.6).fillColor('#000');

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = pageWidth / table.columns.length;
    const startX = doc.page.margins.left;

    const writeRow = (cells: Array<string | number>, bold: boolean) => {
      const y = doc.y;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
      cells.forEach((cell, i) => {
        doc.text(String(cell ?? ''), startX + i * colWidth, y, {
          width: colWidth - 4,
          ellipsis: true,
        });
      });
      doc.moveDown(0.4);
    };

    writeRow(
      table.columns.map((c) => c.header),
      true,
    );
    doc
      .moveTo(startX, doc.y)
      .lineTo(startX + pageWidth, doc.y)
      .stroke('#ccc');
    doc.moveDown(0.2);
    for (const row of table.rows) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 20) doc.addPage();
      writeRow(
        table.columns.map((c) => row[c.key] ?? ''),
        false,
      );
    }

    doc.end();
    return done;
  }
}
