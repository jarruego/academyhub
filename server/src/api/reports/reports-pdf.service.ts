import { Injectable, Logger } from '@nestjs/common';
import { ReportsRepository } from 'src/database/repository/reports/reports.repository';
import { ReportsService } from './reports.service';
import type { ReportFilterDTO } from 'src/dto/reports/report-filter.dto';
import type { ReportRowDTO } from 'src/dto/reports/report-row.dto';
import type { ReportExportDTO } from 'src/dto/reports/report-export.dto';
import type { Response } from 'express';
import { PdfService } from 'src/common/pdf/pdf.service';
import { ReportRenderer } from './report-renderer.service';
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
    private readonly reportRenderer: ReportRenderer,
  ) { }

  /**
   * Stream a simple tabular 'dedication' PDF grouped by center -> course using the shared PdfService
   */
  async streamDedicationPdf(filter: ReportFilterDTO | undefined, res: Response, opts?: { includePasswords?: boolean, logoBuffer?: Buffer, signatureBuffer?: Buffer, issuerName?: string }) {
    // Fetch all rows and delegate to the "fromRows" variant which groups by center/course
    const requestFilter = { ...(filter ?? {}), page: 1, limit: Number(filter?.limit ?? 100000) } as ReportFilterDTO;
    const data = await this.reportsRepository.getReportRows(requestFilter);
    const rows: ReportRowDTO[] = data?.data ?? [];
    return await this.streamDedicationPdfFromRows(rows, res, { includePasswords: opts?.includePasswords, logoBuffer: opts?.logoBuffer, signatureBuffer: opts?.signatureBuffer, issuerName: opts?.issuerName });
  }

  async streamDedicationPdfFromRows(rows: ReportRowDTO[], res: Response, opts?: { includePasswords?: boolean, logoBuffer?: Buffer, signatureBuffer?: Buffer, issuerName?: string }) {
    // Group rows by center -> course and render per-course pages matching the requested layout.
    const sorted = (rows ?? []).slice().sort((a, b) => {
      const c = String(a.center_name ?? '').localeCompare(String(b.center_name ?? ''));
      if (c !== 0) return c;
      const d = String(a.course_name ?? '').localeCompare(String(b.course_name ?? ''));
      if (d !== 0) return d;
      const p = Number(b.completion_percentage ?? 0) - Number(a.completion_percentage ?? 0);
      if (p !== 0) return p;
      return String(a.first_surname ?? '').localeCompare(String(b.first_surname ?? '')) || String(a.second_surname ?? '').localeCompare(String(b.second_surname ?? ''));
    });

    const groups: Array<{ center: string; course: string; rows: ReportRowDTO[] }> = [];
    for (const r of sorted) {
      const center = String(r.center_name ?? 'Sin centro');
      const course = String(r.course_name ?? 'Sin curso');
      const last = groups[groups.length - 1];
      if (last && last.center === center && last.course === course) last.rows.push(r);
      else groups.push({ center, course, rows: [r] });
    }

    const doc = this.pdfService.createDocument({ size: 'A4', margin: 40 });
    this.pdfService.streamDocumentToResponse(doc, res, 'report-dedication.pdf');

    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      if (gi > 0) doc.addPage();

      // optional logo top-right
      if (opts?.logoBuffer) {
        const marginLeft = doc.page.margins?.left ?? 40;
        const marginRight = doc.page.margins?.right ?? 40;
        const usableWidth = doc.page.width - marginLeft - marginRight;
        const lx = doc.x + (usableWidth - 120);
        this.pdfService.embedImageSafe(doc, opts.logoBuffer, lx, doc.y, { width: 120 });
      }

      // Title: Cursos [CENTRO] (fecha actual)
      const issueDate = new Date().toLocaleDateString('es-ES');
      doc.moveDown(0.5);
      try { doc.fillColor('#7E1515'); } catch (e) { }
      doc.fontSize(14).text(`Cursos ${g.center} (${issueDate})`, { align: 'left' });
      doc.moveDown(0.4);

      // Course title
      try { doc.fillColor('#0033CC'); doc.font('Helvetica-Bold'); } catch (e) { }
      doc.fontSize(16).text(g.course, { align: 'left' });
      doc.moveDown(0.4);

      // reset style for table
      try { doc.fillColor('black'); doc.font('Helvetica'); } catch (e) { }

      // Table: Usuario | [Clave] | Alumno | % (Clave is optional based on includePasswords)
      const leftMargin = doc.page.margins?.left ?? 40;
      const rightMargin = doc.page.margins?.right ?? 40;
      const pageWidth = doc.page.width - leftMargin - rightMargin;
      const colUsuario = 120;
      const colClave = opts?.includePasswords ? 100 : 0;
      const colPercent = 60;
      const colAlumno = Math.max(80, Math.floor(pageWidth - (colUsuario + colClave + colPercent)));
      const colWidths = opts?.includePasswords 
        ? [colUsuario, colClave, colAlumno, colPercent]
        : [colUsuario, colAlumno, colPercent];
      const startX = doc.x;
      const colPositions = colWidths.map((w, i) => startX + colWidths.slice(0, i).reduce((s, v) => s + v, 0));
      const lineHeight = 12;

      // header - draw all headers using the same baseline to avoid staggered wrapping
      doc.font('Helvetica-Bold').fontSize(9);
      const headerY = doc.y;
      if (opts?.includePasswords) {
        doc.text('Usuario', colPositions[0], headerY, { width: colWidths[0], ellipsis: true });
        doc.text('Clave', colPositions[1], headerY, { width: colWidths[1], ellipsis: true });
        doc.text('Alumno', colPositions[2], headerY, { width: colWidths[2], ellipsis: true });
        doc.text('%', colPositions[3], headerY, { width: colWidths[3], ellipsis: true });
      } else {
        doc.text('Usuario', colPositions[0], headerY, { width: colWidths[0], ellipsis: true });
        doc.text('Alumno', colPositions[1], headerY, { width: colWidths[1], ellipsis: true });
        doc.text('%', colPositions[2], headerY, { width: colWidths[2], ellipsis: true });
      }
      // advance cursor below header
      doc.y = headerY + lineHeight;
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(9);

      let currentY = doc.y;
      const pageBottom = doc.page.height - (doc.page.margins?.bottom ?? 40) - 40;

      for (const r of g.rows) {
        // page break
        if (currentY > pageBottom) {
          doc.addPage();
          currentY = doc.y;
          // redraw header on new page using fixed baseline
          doc.font('Helvetica-Bold').fontSize(9);
          const headerY2 = doc.y;
          if (opts?.includePasswords) {
            doc.text('Usuario', colPositions[0], headerY2, { width: colWidths[0], ellipsis: true });
            doc.text('Clave', colPositions[1], headerY2, { width: colWidths[1], ellipsis: true });
            doc.text('Alumno', colPositions[2], headerY2, { width: colWidths[2], ellipsis: true });
            doc.text('%', colPositions[3], headerY2, { width: colWidths[3], ellipsis: true });
          } else {
            doc.text('Usuario', colPositions[0], headerY2, { width: colWidths[0], ellipsis: true });
            doc.text('Alumno', colPositions[1], headerY2, { width: colWidths[1], ellipsis: true });
            doc.text('%', colPositions[2], headerY2, { width: colWidths[2], ellipsis: true });
          }
          doc.y = headerY2 + lineHeight;
          doc.moveDown(0.2);
          doc.font('Helvetica').fontSize(9);
          currentY = doc.y;
        }

        const usuario = String(r.moodle_username ?? '');
        const clave = String(r.moodle_password ?? '');
        const alumno = `${String(r.first_surname ?? '').toUpperCase()} ${String(r.second_surname ?? '').toUpperCase()}, ${String(r.name ?? '')}`.trim();
        const pct = `${Number(r.completion_percentage ?? 0)}%`;

        if (opts?.includePasswords) {
          doc.text(usuario, colPositions[0], currentY, { width: colWidths[0], ellipsis: true });
          doc.text(clave, colPositions[1], currentY, { width: colWidths[1], ellipsis: true });
          doc.text(alumno, colPositions[2], currentY, { width: colWidths[2], ellipsis: true });
          doc.text(pct, colPositions[3], currentY, { width: colWidths[3], ellipsis: true });
        } else {
          doc.text(usuario, colPositions[0], currentY, { width: colWidths[0], ellipsis: true });
          doc.text(alumno, colPositions[1], currentY, { width: colWidths[1], ellipsis: true });
          doc.text(pct, colPositions[2], currentY, { width: colWidths[2], ellipsis: true });
        }

        currentY += lineHeight;
        doc.y = currentY;
      }

      doc.moveDown(0.6);
    }

    this.pdfService.endDocument(doc);
  }

  /**
   * Stream a certification-style PDF grouped by center -> course -> group.
   * For each group we render a short paragraph certifying attendance and a
   * simple table with Nombre, Apellidos y DNI. Pages break by center, course and group.
   */
  async streamCertificationPdf(filter: ReportFilterDTO | undefined, res: Response, opts?: { issuerName?: string, logoBuffer?: Buffer, signatureBuffer?: Buffer, companyCity?: string }) {
    // Fetch all matching rows (no pagination) and group them so each group
    // gets its own certificate page with proper center/course/group variables.
    const requestFilter = { ...(filter ?? {}), page: 1, limit: Number(filter?.limit ?? 100000) } as ReportFilterDTO;
    const data = await this.reportsRepository.getReportRows(requestFilter);
    let rows: ReportRowDTO[] = data?.data ?? [];
    // sort rows so grouping is stable and names appear ordered inside each group
    rows = rows.slice().sort((a, b) => {
      const c = String(a.center_name ?? '').localeCompare(String(b.center_name ?? ''));
      if (c !== 0) return c;
      const d = String(a.course_name ?? '').localeCompare(String(b.course_name ?? ''));
      if (d !== 0) return d;
      const g = Number(a.id_group ?? 0) - Number(b.id_group ?? 0);
      if (g !== 0) return g;
      const a1 = String(a.first_surname ?? '').localeCompare(String(b.first_surname ?? ''));
      if (a1 !== 0) return a1;
      return String(a.second_surname ?? '').localeCompare(String(b.second_surname ?? ''));
    });

    // Group rows by center -> course -> group
    const grouped: Array<{ center: string; course: string; groupId: number | undefined; rows: ReportRowDTO[] }> = [];
    for (const r of rows) {
      const center = String(r.center_name ?? 'Sin centro');
      const course = String(r.course_name ?? 'Sin curso');
      const gid = r.id_group;
      const last = grouped[grouped.length - 1];
      if (last && last.center === center && last.course === course && last.groupId === gid) {
        last.rows.push(r);
      } else {
        grouped.push({ center, course, groupId: gid, rows: [r] });
      }
    }

    // Create a single PDF document and stream it once
    const doc = this.pdfService.createDocument({ size: 'A4', margin: 40 });
    this.pdfService.streamDocumentToResponse(doc, res, 'report-certification.pdf');

    // Iterate grouped units and render the template into the same document
    for (let i = 0; i < grouped.length; i++) {
      const g = grouped[i];
      if (i > 0) doc.addPage();

      // prepare mapped rows for the template
      const mapped = g.rows.map((r) => ({
        ...r,
        employee: `${String(r.first_surname ?? '').toUpperCase()} ${String(r.second_surname ?? '').toUpperCase()}, ${String(r.name ?? '')}`.trim(),
      }));

      const first = g.rows[0];
      const center_name = g.center;
      const course_name = g.course;
      const start_date = first?.group_start_date ? new Date(first.group_start_date).toLocaleDateString('es-ES') : '';
      const end_date = first?.group_end_date ? new Date(first.group_end_date).toLocaleDateString('es-ES') : '';
      const company_name = first?.company_name ?? '';
      const issue_date = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      const hours = first?.hours ?? '';
      const modality = first?.modality ?? '';

      const ctx: Record<string, unknown> = {
        rows: mapped,
        issuer: opts?.issuerName ?? undefined,
        logo: opts?.logoBuffer ?? undefined,
        signature: opts?.signatureBuffer ?? undefined,
        center_name,
        course_name,
        start_date,
        end_date,
        company_name,
        company_city: opts?.companyCity ?? center_name,
        hours,
        modality,
        issue_date,
      };

      // Render this group's template into the document
      // Note: renderTemplateIntoDocument will not end the doc; we continue for the next group
      // and finally end the document below.
      // eslint-disable-next-line no-await-in-loop
      await this.reportRenderer.renderTemplateIntoDocument(doc, 'certification-v1', ctx);
    }

    // Ensure we end the doc
    this.pdfService.endDocument(doc);
  }

  async streamCertificationPdfFromRows(rows: ReportRowDTO[], res: Response, opts?: { issuerName?: string, logoBuffer?: Buffer, signatureBuffer?: Buffer, companyCity?: string }) {
    // Group rows by center -> course -> group and render one template per group
    const sorted = (rows ?? []).slice().sort((a, b) => {
      const c = String(a.center_name ?? '').localeCompare(String(b.center_name ?? ''));
      if (c !== 0) return c;
      const d = String(a.course_name ?? '').localeCompare(String(b.course_name ?? ''));
      if (d !== 0) return d;
      const g = Number(a.id_group ?? 0) - Number(b.id_group ?? 0);
      if (g !== 0) return g;
      return String(a.first_surname ?? '').localeCompare(String(b.first_surname ?? '')) || String(a.second_surname ?? '').localeCompare(String(b.second_surname ?? ''));
    });

    const groups: Array<{ center: string; course: string; groupId: number | undefined; rows: ReportRowDTO[] }> = [];
    for (const r of sorted) {
      const center = String(r.center_name ?? 'Sin centro');
      const course = String(r.course_name ?? 'Sin curso');
      const gid = r.id_group;
      const last = groups[groups.length - 1];
      if (last && last.center === center && last.course === course && last.groupId === gid) last.rows.push(r);
      else groups.push({ center, course, groupId: gid, rows: [r] });
    }

    const doc = this.pdfService.createDocument({ size: 'A4', margin: 40 });
    this.pdfService.streamDocumentToResponse(doc, res, 'report-certification.pdf');

    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      if (gi > 0) doc.addPage();

      const mapped = g.rows.map((r) => ({
        ...r,
        employee: `${String(r.first_surname ?? '').toUpperCase()} ${String(r.second_surname ?? '').toUpperCase()}, ${String(r.name ?? '')}`.trim(),
      }));

      const first = g.rows[0];
      const center_name = g.center;
      const course_name = g.course;
      const start_date = first?.group_start_date ? new Date(first.group_start_date).toLocaleDateString('es-ES') : '';
      const end_date = first?.group_end_date ? new Date(first.group_end_date).toLocaleDateString('es-ES') : '';
      const company_name = first?.company_name ?? '';
      const issue_date = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

      const hours = first?.hours ?? '';
      const modality = first?.modality ?? '';

      const ctx: Record<string, unknown> = {
        rows: mapped,
        issuer: opts?.issuerName ?? undefined,
        logo: opts?.logoBuffer ?? undefined,
        signature: opts?.signatureBuffer ?? undefined,
        center_name,
        course_name,
        start_date,
        end_date,
        company_name,
        company_city: opts?.companyCity ?? center_name,
        hours,
        modality,
        issue_date,
      };

      // eslint-disable-next-line no-await-in-loop
      await this.reportRenderer.renderTemplateIntoDocument(doc, 'certification-v1', ctx);
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

    let companyCity: string | undefined = undefined;
    if (orgRow) {
      try {
        const settings = (orgRow.settings ?? {}) as Record<string, unknown>;
        const company = (settings && typeof settings === 'object') ? (settings['company'] as Record<string, unknown> | undefined) : undefined;
        if (company) {
          const responsable = (company.responsable_nombre as string | undefined) ?? undefined;
          const razon = (company.razon_social as string | undefined) ?? undefined;
          const cif = (company.cif as string | undefined) ?? undefined;
          const direccion = (company.direccion as string | undefined) ?? undefined;
          const ciudad = (company.ciudad as string | undefined) ?? undefined;
          if (ciudad) companyCity = ciudad;
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
      await rowsRendererFromRows(rows, res, report_type === 'certification' ? { issuerName, logoBuffer, signatureBuffer, companyCity } : { includePasswords, logoBuffer, signatureBuffer, issuerName });
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
      await rowsRendererFromRows(rows, res, report_type === 'certification' ? { issuerName, logoBuffer, signatureBuffer, companyCity } : { includePasswords, logoBuffer, signatureBuffer, issuerName });
      return;
    }

    // Default: generate report by applying the filter server-side (force no pagination)
    await rendererFromFilter(exportFilter, res, report_type === 'certification' ? { issuerName, logoBuffer, signatureBuffer, companyCity } : { includePasswords, logoBuffer, signatureBuffer, issuerName });
  }
}
