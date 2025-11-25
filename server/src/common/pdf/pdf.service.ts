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

  endDocument(doc: PDFKit.PDFDocument) {
    try {
      doc.end();
    } catch (err) {
      this.logger.error('Error ending PDF document: ' + String(err));
    }
  }
}
