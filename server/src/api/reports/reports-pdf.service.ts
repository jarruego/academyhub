import { Injectable, Logger } from '@nestjs/common';
import { ReportsRepository } from 'src/database/repository/reports/reports.repository';
import { ReportsService } from './reports.service';
import type { ReportFilterDTO } from 'src/dto/reports/report-filter.dto';
import type { ReportRowDTO } from 'src/dto/reports/report-row.dto';
import type { ReportExportDTO } from 'src/dto/reports/report-export.dto';
import type { Response } from 'express';
import { PdfService } from 'src/common/pdf/pdf.service';
import { OrganizationRepository } from 'src/database/repository/organization/organization.repository';
import { OrganizationSettingsSelectModel } from 'src/database/schema/tables/organization_settings.table';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class ReportsPdfService {
  private readonly logger = new Logger(ReportsPdfService.name);
  constructor(
    private readonly reportsRepository: ReportsRepository,
    private readonly pdfService: PdfService,
    private readonly reportsService: ReportsService,
    private readonly organizationRepository: OrganizationRepository,
  ) {}

  /**
   * Stream a simple tabular 'dedication' PDF grouped by center -> course using the shared PdfService
   */
  async streamDedicationPdf(filter: ReportFilterDTO | undefined, res: Response, opts?: { includePasswords?: boolean, logoBuffer?: Buffer, signatureBuffer?: Buffer, issuerName?: string }) {
    // Ensure we request a sufficiently large limit so we get all rows for export.
    const requestFilter = { ...(filter ?? {}), page: 1, limit: Number(filter?.limit ?? 100000) } as ReportFilterDTO;

    const data = await this.reportsRepository.getReportRows(requestFilter);
    const rows: ReportRowDTO[] = data?.data ?? [];

    return this.streamDedicationPdfFromRows(rows, res, opts);
  }

  async streamDedicationPdfFromRows(rows: ReportRowDTO[], res: Response, opts?: { includePasswords?: boolean, logoBuffer?: Buffer, signatureBuffer?: Buffer, issuerName?: string }) {
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

    // Organization header (issuer) if provided
    if (opts?.issuerName) {
      doc.moveDown(0.2);
      doc.fontSize(10).text(opts.issuerName, { align: 'left' });
      doc.moveDown(0.4);
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

  /**
   * Stream a certification-style PDF grouped by center -> course -> group.
   * For each group we render a short paragraph certifying attendance and a
   * simple table with Nombre, Apellidos y DNI. Pages break by center, course and group.
   */
  async streamCertificationPdf(filter: ReportFilterDTO | undefined, res: Response, opts?: { issuerName?: string, logoBuffer?: Buffer, signatureBuffer?: Buffer }) {
    const requestFilter = { ...(filter ?? {}), page: 1, limit: Number(filter?.limit ?? 100000) } as ReportFilterDTO;
    const data = await this.reportsRepository.getReportRows(requestFilter);
    const rows: ReportRowDTO[] = data?.data ?? [];
    return this.streamCertificationPdfFromRows(rows, res, opts);
  }

  async streamCertificationPdfFromRows(rows: ReportRowDTO[], res: Response, opts?: { issuerName?: string, logoBuffer?: Buffer, signatureBuffer?: Buffer }) {
    // Group by center -> course -> group
    const centersMap = new Map<string, Map<string, Map<string, ReportRowDTO[]>>>();
    for (const r of rows) {
      const center = String(r.center_name ?? 'Sin centro');
      const course = String(r.course_name ?? 'Sin curso');
      const group = String(r.group_name ?? 'Sin grupo');
      if (!centersMap.has(center)) centersMap.set(center, new Map());
      const courseMap = centersMap.get(center)!;
      if (!courseMap.has(course)) courseMap.set(course, new Map());
      const groupMap = courseMap.get(course)!;
      if (!groupMap.has(group)) groupMap.set(group, []);
      groupMap.get(group)!.push(r);
    }

    const doc = this.pdfService.createDocument({ size: 'A4', margin: 40 });
    this.pdfService.streamDocumentToResponse(doc, res, 'report-certification.pdf');

    if (opts?.logoBuffer) this.pdfService.embedImageSafe(doc, opts.logoBuffer, doc.x, doc.y, { width: 120 });

  const issuer = opts?.issuerName ?? 'Fulanito de Tal';

    const centerEntries = Array.from(centersMap.entries());
    for (let ci = 0; ci < centerEntries.length; ci++) {
      const [centerName, courseMap] = centerEntries[ci];
      if (ci > 0) doc.addPage();
      doc.fontSize(12).text(`Centro: ${centerName}`, { underline: true });
      doc.moveDown(0.3);

      const courseEntries = Array.from(courseMap.entries());
      for (let cj = 0; cj < courseEntries.length; cj++) {
        const [courseName, groupMap] = courseEntries[cj];
        if (cj > 0) doc.addPage();
        doc.fontSize(11).text(`Curso: ${courseName}`);
        doc.moveDown(0.2);

        const groupEntries = Array.from(groupMap.entries());
        for (let gk = 0; gk < groupEntries.length; gk++) {
          const [groupName, students] = groupEntries[gk];
          if (gk > 0) doc.addPage();

          // derive some group-level metadata from the first student row
          const first = students[0];
          const companyName = first?.company_name ?? '';
          const start = first?.group_start_date ? new Date(first.group_start_date).toLocaleDateString('es-ES') : '';
          const end = first?.group_end_date ? new Date(first.group_end_date).toLocaleDateString('es-ES') : '';

          const paragraph = `${issuer} certifica que los usuarios del ${centerName} (${companyName}) han realizado el curso ${courseName} entre las fechas ${start} y ${end}.`;
          doc.fontSize(10).text(paragraph, { align: 'left' });
          doc.moveDown(0.4);

          // simple table with Nombre | Apellidos | DNI
          const leftMargin = (doc.page?.margins?.left ?? 40);
          const rightMargin = (doc.page?.margins?.right ?? 40);
          const availableWidth = (doc.page.width - leftMargin - rightMargin);
          const ratios = [0.45, 0.35, 0.20];
          const colWidths = ratios.map(r => Math.floor(availableWidth * r));
          const startX = doc.x;
          const colPositions = colWidths.reduce<number[]>((acc, w, i) => {
            if (i === 0) acc.push(startX); else acc.push(acc[i - 1] + colWidths[i - 1]);
            return acc;
          }, [] as number[]);

          doc.fontSize(9).font('Helvetica-Bold');
          const headerY = doc.y;
          doc.text('Nombre', colPositions[0], headerY, { width: colWidths[0], ellipsis: true });
          doc.text('Apellidos', colPositions[1], headerY, { width: colWidths[1], ellipsis: true });
          doc.text('DNI', colPositions[2], headerY, { width: colWidths[2], ellipsis: true });
          doc.moveDown(0.6);
          doc.font('Helvetica');

          const lineHeight = 12;
          let currentY = doc.y;

          for (const s of students) {
            if (currentY > doc.page.height - (doc.page.margins?.bottom ?? 40) - 60) {
              doc.addPage();
              currentY = doc.y;
            }

            const name = `${s.name ?? ''}`.trim();
            const apellidos = `${s.first_surname ?? ''} ${s.second_surname ?? ''}`.trim();
            doc.text(name, colPositions[0], currentY, { width: colWidths[0], ellipsis: true });
            doc.text(apellidos, colPositions[1], currentY, { width: colWidths[1], ellipsis: true });
            doc.text(String(s.dni ?? ''), colPositions[2], currentY, { width: colWidths[2], ellipsis: true });

            currentY += lineHeight;
            doc.y = currentY;
          }

          doc.moveDown(0.6);
        }
      }
    }

    if (opts?.signatureBuffer) {
      this.pdfService.embedImageSafe(doc, opts.signatureBuffer, doc.page.width - 200, doc.y, { width: 160 });
    }

    this.pdfService.endDocument(doc);
  }

  /**
   * High-level export handler: accept the export DTO and dispatch the correct
   * generation path (explicit selected keys, select-all matching with deselections
   * or filter-based export). This centralizes export decision logic so the
   * controller remains thin.
   */
  async exportPdfFromPayload(body: ReportExportDTO, res: Response): Promise<void> {
    const { filter, include_passwords, selected_keys, select_all_matching, deselected_keys, report_type } = body;
    const includePasswords = Boolean(include_passwords);

    // Pick the appropriate renderer depending on report_type
    const rowsRendererFromRows = report_type === 'certification' ? this.streamCertificationPdfFromRows.bind(this) : this.streamDedicationPdfFromRows.bind(this);
    const rendererFromFilter = report_type === 'certification' ? this.streamCertificationPdf.bind(this) : this.streamDedicationPdf.bind(this);

  // Load organization settings and assets to include in the PDF (logo/signature and company info)
  let orgRow: OrganizationSettingsSelectModel | null = null;
    try {
      orgRow = await this.organizationRepository.findFirst();
    } catch (e) {
      this.logger.warn({ e }, 'Could not load organization settings for report header');
    }

    let logoBuffer: Buffer | undefined = undefined;
    let signatureBuffer: Buffer | undefined = undefined;
    let issuerName: string | undefined = undefined;

    if (orgRow) {
      try {
  const settings = (orgRow.settings ?? {}) as Record<string, unknown>;
  const company = (settings && typeof settings === 'object') ? (settings['company'] as Record<string, unknown> | undefined) : undefined;
        if (company) {
          const responsable = (company.responsable_nombre as string | undefined) ?? undefined;
          const razon = (company.razon_social as string | undefined) ?? undefined;
          const cif = (company.cif as string | undefined) ?? undefined;
          const direccion = (company.direccion as string | undefined) ?? undefined;
          if (responsable || razon || cif || direccion) {
            issuerName = `${responsable ? `D. ${responsable}, ` : ''}${razon ? `administrador de ${razon}` : ''}${cif ? `, con CIF ${cif}` : ''}${direccion ? ` y domicilio en ${direccion}` : ''}.`;
          }
        }

        const lp = orgRow.logo_path as string | undefined;
        const sp = orgRow.signature_path as string | undefined;
        if (lp) {
          try {
            const rel = lp.replace(/^\/+/, '');
            const fsPath = path.join(process.cwd(), 'public', rel);
            logoBuffer = await fs.readFile(fsPath);
          } catch (e) {
            this.logger.warn({ e, lp }, 'Could not read logo file for reports');
          }
        }
        if (sp) {
          try {
            const rel = sp.replace(/^\/+/, '');
            const fsPath = path.join(process.cwd(), 'public', rel);
            signatureBuffer = await fs.readFile(fsPath);
          } catch (e) {
            this.logger.warn({ e, sp }, 'Could not read signature file for reports');
          }
        }
      } catch (e) {
        this.logger.warn({ e }, 'Error while preparing organization assets for report');
      }
    }

    // If client supplied explicit selected keys, generate report for those rows only
    if (Array.isArray(selected_keys) && selected_keys.length) {
      const keys: string[] = selected_keys;
      const data = await this.reportsService.getRowsByKeys(keys);
      const rows: ReportRowDTO[] = Array.isArray(data) ? data : (data?.data ?? []);
      await rowsRendererFromRows(rows, res, report_type === 'certification' ? { issuerName, logoBuffer, signatureBuffer } : { includePasswords, logoBuffer, signatureBuffer, issuerName });
      return;
    }

    // Prepare an export filter that forces no pagination so exports include all matching rows
    const exportFilter = { ...(filter ?? {}), page: 1, limit: 100000 } as ReportFilterDTO;

    // If client requested select-all-matching with deselections, fetch by filter and remove deselected keys
    if (select_all_matching) {
      const data = await this.reportsService.findAll(exportFilter);
      let rows: ReportRowDTO[] = data?.data ?? [];
      const deselected: string[] = Array.isArray(deselected_keys) ? deselected_keys : [];
      if (deselected.length) {
        rows = rows.filter((r) => {
          const key = (r.id_user != null && r.id_group != null) ? `${r.id_user}-${r.id_group}` : `${r.dni ?? ''}-${r.moodle_id ?? ''}`;
          return !deselected.includes(key);
        });
      }
      await rowsRendererFromRows(rows, res, report_type === 'certification' ? { issuerName, logoBuffer, signatureBuffer } : { includePasswords, logoBuffer, signatureBuffer, issuerName });
      return;
    }

    // Default: generate report by applying the filter server-side (force no pagination)
    await rendererFromFilter(exportFilter, res, report_type === 'certification' ? { issuerName, logoBuffer, signatureBuffer } : { includePasswords, logoBuffer, signatureBuffer, issuerName });
  }
}
