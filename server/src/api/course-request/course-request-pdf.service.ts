import { Injectable } from "@nestjs/common";
import type { Response } from "express";
import { PdfService } from "src/common/pdf/pdf.service";

export type CourseRequestReportRow = {
  id_company: number | null;
  company_name: string | null;
  id_center: number | null;
  center_name: string | null;
  id_course: number;
  course_name: string;
  request_count: number;
  student_count: number;
};

@Injectable()
export class CourseRequestPdfService {
  constructor(private readonly pdfService: PdfService) {}

  /**
   * PDF agrupado Empresa -> Curso -> Centro (nº de alumnos por centro, con
   * totales por curso y por empresa), en el estilo de los informes de
   * bonificación ya existentes (texto directo con PDFKit, sin plantilla JSON:
   * el agrupamiento en 3 niveles no encaja en el renderer de tablas planas).
   */
  streamReportPdf(rows: CourseRequestReportRow[], res: Response) {
    const doc = this.pdfService.createDocument({ size: "A4", margin: 40 });
    this.pdfService.streamDocumentToResponse(doc, res, "informe-peticiones.pdf");

    const issueDate = new Date().toLocaleDateString("es-ES");

    // Empresa -> Curso -> filas de centro
    const byCompany = new Map<string, { name: string; courses: Map<string, { name: string; rows: CourseRequestReportRow[] }> }>();
    for (const row of rows) {
      const companyKey = row.id_company != null ? String(row.id_company) : "none";
      const companyName = row.company_name ?? "Sin empresa";
      if (!byCompany.has(companyKey)) byCompany.set(companyKey, { name: companyName, courses: new Map() });
      const company = byCompany.get(companyKey)!;

      const courseKey = String(row.id_course);
      if (!company.courses.has(courseKey)) company.courses.set(courseKey, { name: row.course_name, rows: [] });
      company.courses.get(courseKey)!.rows.push(row);
    }

    const companies = Array.from(byCompany.values()).sort((a, b) => a.name.localeCompare(b.name));

    try { doc.fillColor("#7E1515"); } catch { /* ignore */ }
    doc.fontSize(14).text(`Informe de peticiones de centros (${issueDate})`, { align: "left" });
    doc.moveDown(0.6);
    try { doc.fillColor("#000000"); doc.font("Helvetica"); } catch { /* ignore */ }

    if (!companies.length) {
      doc.fontSize(10).text("No hay peticiones para los filtros seleccionados.");
    }

    let grandTotalStudents = 0;

    for (const company of companies) {
      try { doc.fillColor("#0033CC"); doc.font("Helvetica-Bold"); } catch { /* ignore */ }
      doc.fontSize(13).text(`Empresa: ${company.name}`, { align: "left" });
      doc.moveDown(0.2);

      const courses = Array.from(company.courses.values()).sort((a, b) => a.name.localeCompare(b.name));
      let companyStudents = 0;

      for (const course of courses) {
        try { doc.fillColor("#333333"); doc.font("Helvetica-Bold"); } catch { /* ignore */ }
        doc.fontSize(11).text(`  Curso: ${course.name}`, { indent: 10 });

        try { doc.fillColor("#000000"); doc.font("Helvetica"); } catch { /* ignore */ }
        doc.fontSize(10);

        const centersSorted = course.rows
          .slice()
          .sort((a, b) => (a.center_name ?? "").localeCompare(b.center_name ?? ""));

        let courseStudents = 0;
        for (const r of centersSorted) {
          const centerLabel = r.center_name ?? "Sin centro";
          doc.text(`    Centro: ${centerLabel} — Alumnos: ${r.student_count} (peticiones: ${r.request_count})`, { indent: 20 });
          courseStudents += r.student_count;
        }
        companyStudents += courseStudents;

        try { doc.fillColor("#666666"); doc.font("Helvetica-Bold"); } catch { /* ignore */ }
        doc.fontSize(10).text(`    Total curso: ${courseStudents} alumno(s)`, { indent: 20 });
        doc.moveDown(0.3);
        try { doc.fillColor("#000000"); doc.font("Helvetica"); } catch { /* ignore */ }
      }

      grandTotalStudents += companyStudents;
      try { doc.fillColor("#7E1515"); doc.font("Helvetica-Bold"); } catch { /* ignore */ }
      doc.fontSize(11).text(`  Total empresa ${company.name}: ${companyStudents} alumno(s)`, { indent: 10 });
      doc.moveDown(0.6);
      try { doc.fillColor("#000000"); doc.font("Helvetica"); } catch { /* ignore */ }
    }

    if (companies.length) {
      doc.moveDown(0.2);
      try { doc.fillColor("#7E1515"); doc.font("Helvetica-Bold"); } catch { /* ignore */ }
      doc.fontSize(12).text(`Total general: ${grandTotalStudents} alumno(s)`, { align: "left" });
    }

    this.pdfService.endDocument(doc);
  }
}
