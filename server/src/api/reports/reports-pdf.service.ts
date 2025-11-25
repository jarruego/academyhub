import { Injectable, Logger } from '@nestjs/common';
import { ReportsRepository } from 'src/database/repository/reports/reports.repository';
import type { ReportFilterDTO } from 'src/dto/reports/report-filter.dto';
import type { ReportRowDTO } from 'src/dto/reports/report-row.dto';
import type { Response } from 'express';
import { PdfService } from 'src/common/pdf/pdf.service';

@Injectable()
export class ReportsPdfService {
  private readonly logger = new Logger(ReportsPdfService.name);
  constructor(
    private readonly reportsRepository: ReportsRepository,
    private readonly pdfService: PdfService,
  ) {}

  /**
   * Stream a simple tabular 'dedication' PDF grouped by center -> course using the shared PdfService
   */
  async streamDedicationPdf(filter: ReportFilterDTO | undefined, res: Response, opts?: { includePasswords?: boolean, logoBuffer?: Buffer, signatureBuffer?: Buffer }) {
    // Ensure we request a sufficiently large limit so we get all rows for export.
    const requestFilter = { ...(filter ?? {}), page: 1, limit: Number(filter?.limit ?? 100000) } as ReportFilterDTO;

  const data = await this.reportsRepository.getReportRows(requestFilter);
  const rows: ReportRowDTO[] = data?.data ?? [];

    // Group by center_name then course_name
    const centersMap = new Map<string, Map<string, ReportRowDTO[]>>();
    for (const r of rows) {
      const center = String(r.center_name ?? 'Sin centro');
      const course = String(r.course_name ?? 'Sin curso');
      if (!centersMap.has(center)) centersMap.set(center, new Map());
      const courseMap = centersMap.get(center)!;
      if (!courseMap.has(course)) courseMap.set(course, []);
  courseMap.get(course)!.push(r);
    }

    const doc = this.pdfService.createDocument({ size: 'A4', margin: 40 });
    this.pdfService.streamDocumentToResponse(doc, res, 'report-dedication.pdf');

    // Header: logo (optional)
    if (opts?.logoBuffer) {
      // use pdfService helper so errors are handled consistently
      this.pdfService.embedImageSafe(doc, opts.logoBuffer, doc.x, doc.y, { width: 120 });
    }

    this.pdfService.addHeader(doc, 'Informe de dedicación');

    // iterate centers/courses (ensure new page when center or course changes)
    const centerEntries = Array.from(centersMap.entries());
    for (let ci = 0; ci < centerEntries.length; ci++) {
      const [centerName, courseMap] = centerEntries[ci];
      // start each center on a new page except the very first
      if (ci > 0) doc.addPage();
      doc.fontSize(12).text(`Centro: ${centerName}`, { underline: true });
      doc.moveDown(0.3);
      const courseEntries = Array.from(courseMap.entries());
      for (let cj = 0; cj < courseEntries.length; cj++) {
        const [courseName, students] = courseEntries[cj];
        // start each course on a new page except the first of the center
        if (cj > 0) doc.addPage();
        doc.fontSize(11).text(`Curso: ${courseName}`);
        doc.moveDown(0.2);

        // table header: compute column widths so the table fits the page
        const leftMargin = (doc.page?.margins?.left ?? 40);
        const rightMargin = (doc.page?.margins?.right ?? 40);
        const availableWidth = (doc.page.width - leftMargin - rightMargin);
        // columns: name, dni, user, password (optional), progress
        const ratios = opts?.includePasswords ? [0.40, 0.15, 0.20, 0.15, 0.10] : [0.50, 0.18, 0.22, 0.10];
        const colWidths: number[] = [];
        if (opts?.includePasswords) {
          colWidths.push(...ratios.map(r => Math.floor(availableWidth * r)));
        } else {
          // when password not shown, map ratios to name,dni,user,progress
          colWidths.push(...ratios.map(r => Math.floor(availableWidth * r)));
        }

        const startX = doc.x;
        const colPositions = colWidths.reduce<number[]>((acc, w, i) => {
          if (i === 0) acc.push(startX); else acc.push(acc[i - 1] + colWidths[i - 1]);
          return acc;
        }, [] as number[]);

        doc.fontSize(9).font('Helvetica-Bold');
        const headerY = doc.y;
        // write header cells at the same Y to avoid staggered lines
        doc.text('Nombre', colPositions[0], headerY, { width: colWidths[0], ellipsis: true });
        doc.text('DNI', colPositions[1], headerY, { width: colWidths[1], ellipsis: true });
        doc.text('Usuario', colPositions[2], headerY, { width: colWidths[2], ellipsis: true });
        if (opts?.includePasswords) doc.text('Password', colPositions[3], headerY, { width: colWidths[3], ellipsis: true });
        const progressIndex = opts?.includePasswords ? 4 : 3;
        doc.text('Progreso', colPositions[progressIndex], headerY, { width: colWidths[progressIndex], ellipsis: true });
        doc.moveDown(0.6);
        doc.font('Helvetica');

        // row rendering: keep a manual currentY so every column stays on the same line
        const lineHeight = 12; // px per row at fontSize 9
        let currentY = doc.y;

        for (const s of students) {
          // page break control: leave 60px bottom margin
          if (currentY > doc.page.height - (doc.page.margins?.bottom ?? 40) - 60) {
            doc.addPage();
            currentY = doc.y;
          }

          const name = `${s.name ?? ''} ${s.first_surname ?? ''}`.trim();
          doc.text(name, colPositions[0], currentY, { width: colWidths[0], ellipsis: true });
          doc.text(String(s.dni ?? ''), colPositions[1], currentY, { width: colWidths[1], ellipsis: true });
          doc.text(String(s.moodle_username ?? ''), colPositions[2], currentY, { width: colWidths[2], ellipsis: true });
          if (opts?.includePasswords) doc.text(String(s.moodle_password ?? ''), colPositions[3], currentY, { width: colWidths[3], ellipsis: true });
          doc.text(`${Number(s.completion_percentage ?? 0)}%`, colPositions[progressIndex], currentY, { width: colWidths[progressIndex], ellipsis: true });

          currentY += lineHeight;
          doc.y = currentY;
        }

        doc.moveDown(0.6);
      }
    }

    // Optionally: signature at the end
    if (opts?.signatureBuffer) {
      this.pdfService.embedImageSafe(doc, opts.signatureBuffer, doc.page.width - 200, doc.y, { width: 160 });
    }

    this.pdfService.endDocument(doc);
  }
}
