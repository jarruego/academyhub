import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type * as PDFKit from 'pdfkit';

/**
 * Lightweight wrapper around PDFKit to centralize creation/streaming and
 * common helpers (image embedding, headers/footers). Keep implementation
 * minimal to avoid heavy coupling and allow other report services to use it.
 */
@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  createDocument(options?: PDFKit.PDFDocumentOptions): PDFKit.PDFDocument {
    // lazy require so server can start even if optional deps aren't installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require('pdfkit');
    // cast to the typed PDFDocument to keep runtime lazy-require but give TS the shape
    return new PDFDocument(options ?? { size: 'A4', margin: 40 }) as unknown as PDFKit.PDFDocument;
  }

  streamDocumentToResponse(doc: PDFKit.PDFDocument, res: Response, filename = 'report.pdf') {
    try {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      doc.pipe(res);
    } catch (err) {
      this.logger.error('Failed to pipe PDF to response: ' + String(err));
      // rethrow so callers can handle
      throw err;
    }
  }

  async embedImageSafe(doc: PDFKit.PDFDocument, buffer?: Buffer | null, x?: number, y?: number, opts?: PDFKit.ImageOptions) {
    if (!buffer) return;
    try {
      doc.image(buffer as Buffer, x ?? doc.x, y ?? doc.y, opts ?? {});
    } catch (err) {
      this.logger.warn('Unable to draw image in PDF: ' + String(err));
    }
  }

  addHeader(doc: PDFKit.PDFDocument, title?: string) {
    if (!title) return;
    try {
      doc.moveDown(0.5);
      doc.fontSize(16).text(title, { align: 'left' });
      doc.moveDown(0.5);
    } catch (err) {
      this.logger.warn('Failed to write header: ' + String(err));
    }
  }

  /**
   * Write a piece of text using a small style object.
   * style: { font?: string; fontSize?: number; align?: 'left'|'center'|'right' }
   */
  writeStyledText(
    doc: PDFKit.PDFDocument,
    text: string,
    style?: { font?: string; fontSize?: number; align?: 'left' | 'center' | 'right'; marginTopLines?: number; marginTop?: number; color?: string }
  ) {
    try {
      // allow templates to request a small top margin in lines or points
      if (style?.marginTopLines && typeof style.marginTopLines === 'number' && style.marginTopLines > 0) {
        doc.moveDown(style.marginTopLines);
      } else if (style?.marginTop && typeof style.marginTop === 'number' && style.marginTop > 0) {
        // move by absolute points
        try { doc.y = (doc.y ?? 0) + style.marginTop; } catch (e) { /* ignore */ }
      }

  // Apply requested style for this text only
  if (style?.font) doc.font(style.font);
  if (style?.fontSize) doc.fontSize(style.fontSize);
  // support optional color
  const prevColor = (doc as any)._fillColor ?? undefined;
  if (style?.color) try { doc.fillColor(style.color); } catch (e) { /* ignore */ }
  doc.text(text, { align: style?.align ?? 'left' });
  // restore previous color if available
  if (typeof prevColor === 'string') try { doc.fillColor(prevColor); } catch (e) { /* ignore */ }
      doc.moveDown(0.4);

      // Prevent style leakage: reset to a sensible default font and size so
      // subsequent writes don't inherit e.g. bold weight accidentally.
      // Many callers explicitly set fonts before complex operations (tables,
      // headers). Resetting here to 'Helvetica' and size 10 is a safe default
      // for template-driven paragraphs. If you need a different default, make
      // it configurable.
      try {
        doc.font('Helvetica');
        doc.fontSize(10);
      } catch (e) {
        /* ignore any error restoring defaults */
      }
    } catch (err) {
      this.logger.warn('writeStyledText failed: ' + String(err));
    }
  }

  /**
   * Render a simple table with automatic pagination when reaching page bottom.
   * columns: array of { title: string; path?: string; width?: number }
   * rows: array of objects
   */
  renderTable(
    doc: PDFKit.PDFDocument,
    columns: Array<{ title: string; path?: string; width?: number }>,
    rows: any[],
    opts?: { headerFont?: string; headerFontSize?: number; cellFont?: string; cellFontSize?: number; rowHeight?: number }
  ) {
    try {
      const marginLeft = doc.page.margins?.left ?? 40;
      const marginRight = doc.page.margins?.right ?? 40;
      const pageWidth = doc.page.width - marginLeft - marginRight;
      // compute column widths: support explicit fixed widths (points) and
      // distribute the remaining width to unspecified columns.
      const usableWidth = pageWidth;
      const fixedWidths = columns.map((c) => (typeof c.width === 'number' && c.width > 0 ? Number(c.width) : null));
      const totalFixed = fixedWidths.reduce((s, v) => s + (v ?? 0), 0);
      const flexibleCount = columns.filter((c) => !(typeof c.width === 'number' && c.width > 0)).length || 1;
      const remaining = Math.max(0, usableWidth - totalFixed);
      const flexibleWidth = Math.floor(remaining / flexibleCount);
      const colWidths = columns.map((c, i) => (fixedWidths[i] ?? flexibleWidth));

      const headerFont = opts?.headerFont ?? 'Helvetica-Bold';
      const headerFontSize = opts?.headerFontSize ?? 9;
      const cellFont = opts?.cellFont ?? 'Helvetica';
      const cellFontSize = opts?.cellFontSize ?? 9;

      const pageBottom = doc.page.height - (doc.page.margins?.bottom ?? 40);

      const renderHeader = () => {
        const startX = doc.x;
        const y = doc.y;
        doc.font(headerFont).fontSize(headerFontSize);
        // draw each header cell and compute header height
        let maxHeaderH = 0;
        columns.forEach((c, i) => {
          const x = startX + colWidths.slice(0, i).reduce((s, v) => s + v, 0);
          const h = doc.heightOfString(String(c.title ?? ''), { width: colWidths[i], align: 'left' });
          maxHeaderH = Math.max(maxHeaderH, h);
          doc.text(String(c.title ?? ''), x, y, { width: colWidths[i], align: 'left' });
        });
        // advance the y position by header height + small padding
        doc.y = y + maxHeaderH + 6;
        doc.font(cellFont).fontSize(cellFontSize);
        // ensure the internal x cursor is reset to the table start
        doc.x = startX;
      };

      const getValue = (row: any, path?: string) => {
        if (!path) return '';
        return String(path.split('.').reduce((acc: any, p: string) => (acc && acc[p] !== undefined ? acc[p] : ''), row) ?? '');
      };

      // start with header
      renderHeader();

  for (const r of rows) {
        // measure the required heights for each cell in this row
        const cellHeights: number[] = [];
        for (let i = 0; i < columns.length; i++) {
          const c = columns[i];
          const text = getValue(r, c.path);
          doc.font(cellFont).fontSize(cellFontSize);
          const h = doc.heightOfString(String(text ?? ''), { width: colWidths[i], align: 'left' });
          cellHeights.push(h);
        }
        const rowHeight = Math.max(...cellHeights, cellFontSize) + 6; // padding

        // pagination check
        if (doc.y + rowHeight > pageBottom) {
          doc.addPage();
          renderHeader();
        }

        const rowY = doc.y;
        const startX = doc.x;
        // draw each cell at computed positions (explicit x,y to avoid cursor shifts)
        for (let i = 0; i < columns.length; i++) {
          const c = columns[i];
          const text = getValue(r, c.path);
          const x = startX + colWidths.slice(0, i).reduce((s, v) => s + v, 0);
          doc.font(cellFont).fontSize(cellFontSize);
          doc.text(String(text ?? ''), x, rowY, { width: colWidths[i], align: 'left' });
        }
        // advance y manually by computed row height and reset internal x to table start
        doc.y = rowY + rowHeight;
        doc.x = startX;
      }
      // ensure internal x restored after table finishes
      try { doc.x = doc.x ?? (doc.page.margins?.left ?? 40); } catch (e) { /* ignore */ }
    } catch (err) {
      this.logger.warn('renderTable failed: ' + String(err));
    }
  }

  endDocument(doc: PDFKit.PDFDocument) {
    try {
      doc.end();
    } catch (err) {
      this.logger.error('Error ending PDF document: ' + String(err));
    }
  }
}
