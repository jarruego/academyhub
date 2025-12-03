import { Injectable, Logger } from '@nestjs/common';
import { PdfService } from 'src/common/pdf/pdf.service';
import type { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ReportTemplate, TemplateElement } from './report-template.interface';

@Injectable()
export class ReportRenderer {
  private readonly logger = new Logger(ReportRenderer.name);
  private templatesDir = path.join(process.cwd(), 'src', 'api', 'reports', 'templates');

  constructor(private readonly pdfService: PdfService) {}

  private async loadTemplate(id: string): Promise<ReportTemplate | null> {
    try {
      const file = path.join(this.templatesDir, `${id}.json`);
      const raw = await fs.readFile(file, 'utf8');
      return JSON.parse(raw) as ReportTemplate;
    } catch (e) {
      this.logger.warn({ e, id }, 'Template not found or failed to load');
      return null;
    }
  }

  /**
   * Simple interpolation using {{var}} tokens from the context
   */
  private interp(text: string, ctx: Record<string, unknown>) {
    return text.replace(/{{\s*([^}]+)\s*}}/g, (_m, key) => {
      const v = ctx[key];
      return v === undefined || v === null ? '' : String(v);
    });
  }

  private async loadImageBuffer(ctx: Record<string, unknown>, varName: string) {
    const buf = ctx[varName];
    if (buf && Buffer.isBuffer(buf)) return buf as Buffer;
    // support path string relative to public
    if (typeof buf === 'string') {
      const rel = (buf as string).replace(/^\/+/, '');
      try {
        return await fs.readFile(path.join(process.cwd(), 'public', rel));
      } catch (e) {
        this.logger.warn({ e, rel }, 'Failed to read image path from context');
        return undefined;
      }
    }
    return undefined;
  }

  private renderElement(doc: any, el: TemplateElement, ctx: Record<string, unknown>, styles: Record<string, any>) {
    const styleName = (el as any).style as string | undefined;
    const styleObj = styleName ? styles?.[styleName] : undefined;

    const getMerged = (key: string) => {
      // element value takes precedence over style
      return (el as any)[key] ?? styleObj?.[key];
    };

    const applyBottomMargin = () => {
      const mbLines = getMerged('marginBottomLines');
      const mb = getMerged('marginBottom');
      if (typeof mbLines === 'number' && mbLines > 0) doc.moveDown(mbLines);
      else if (typeof mb === 'number' && mb > 0) try { doc.y = (doc.y ?? 0) + mb; } catch (e) { /* ignore */ }
    };

    switch (el.type) {
      case 'header':
      case 'title': {
        // allow per-element or style margins
        const mergedTopLines = getMerged('marginTopLines');
        const mergedTop = getMerged('marginTop');
        const mergedStyle: Record<string, any> = { fontSize: styleObj?.fontSize, align: styleObj?.align, font: styleObj?.font };
        if (typeof mergedTopLines === 'number') mergedStyle.marginTopLines = mergedTopLines;
        if (typeof mergedTop === 'number') mergedStyle.marginTop = mergedTop;
        this.pdfService.writeStyledText(doc, this.interp((el as any).text, ctx), mergedStyle);
        applyBottomMargin();
        break;
      }
      case 'paragraph': {
        const mergedTopLines = getMerged('marginTopLines');
        const mergedTop = getMerged('marginTop');
        const mergedStyle: Record<string, any> = { fontSize: styleObj?.fontSize, align: styleObj?.align, font: styleObj?.font };
        if (typeof mergedTopLines === 'number') mergedStyle.marginTopLines = mergedTopLines;
        if (typeof mergedTop === 'number') mergedStyle.marginTop = mergedTop;
        this.pdfService.writeStyledText(doc, this.interp((el as any).text, ctx), mergedStyle);
        applyBottomMargin();
        break;
      }
      case 'image': {
        // images are handled outside in renderTemplate where we can await buffers
        // keep placeholder so templates can include image elements but rendering is done in renderTemplate
        break;
      }
      case 'table': {
        const cols = (el as any).columns ?? [];
        const rows = (ctx[(el as any).rowsVar] as any[]) ?? [];
        // handle top margins for table
        const mergedTopLines = getMerged('marginTopLines');
        const mergedTop = getMerged('marginTop');
        if (typeof mergedTopLines === 'number' && mergedTopLines > 0) doc.moveDown(mergedTopLines);
        else if (typeof mergedTop === 'number' && mergedTop > 0) try { doc.y = (doc.y ?? 0) + mergedTop; } catch (e) { /* ignore */ }
        // map columns to PdfService expected shape (preserve optional width)
        const pdfCols = cols.map((c: any) => ({ title: c.title, path: c.path, width: c.width }));
        this.pdfService.renderTable(doc, pdfCols, rows, { headerFontSize: 9, cellFontSize: 9 });
        // bottom margin
        applyBottomMargin();
        break;
      }
      default:
        // unknown element
        this.logger.warn({ el }, 'Unknown template element');
    }
  }

  /**
   * Render a template by id. ctx can include buffers for images (logo, signature), and rows array.
   */
  async renderTemplate(templateId: string, ctx: Record<string, unknown>, res: Response) {
    const tpl = await this.loadTemplate(templateId);
    if (!tpl) throw new Error(`Template ${templateId} not found`);

    const doc = this.pdfService.createDocument({ size: 'A4', margin: 40 });
    this.pdfService.streamDocumentToResponse(doc, res, `${tpl.meta?.id ?? 'report'}.pdf`);

    // pre-load common images
    const images: Record<string, Buffer | undefined> = {};
    for (const v of ['logo', 'signature']) {
      images[v] = await this.loadImageBuffer(ctx, v);
    }

    // Render first page only (templates are simple for now)
    const page = tpl.pages[0];
    const styles = tpl.styles ?? {};
    // first, iterate elements and render. Images will be placed according to their declared position
    for (const el of page.elements) {
      const t = (el as any).type as string;
      if (t === 'image') {
        const elAny = el as any;
        const buf = images[elAny.var];
        if (!buf) continue;
        const width = elAny.width ?? 120;
        const pos = elAny.position ?? 'top-right';
        const marginLeft = doc.page.margins?.left ?? 40;
        const marginRight = doc.page.margins?.right ?? 40;
        const usableWidth = doc.page.width - marginLeft - marginRight;

        // merge style margins if any
        const styleObj = elAny.style ? styles?.[elAny.style] : undefined;
  const mtLines = elAny.marginTopLines ?? (styleObj as any)?.marginTopLines;
  const mt = elAny.marginTop ?? (styleObj as any)?.marginTop;
  const mbLines = elAny.marginBottomLines ?? (styleObj as any)?.marginBottomLines;
  const mb = elAny.marginBottom ?? (styleObj as any)?.marginBottom;

        if (typeof mtLines === 'number' && mtLines > 0) doc.moveDown(mtLines);
        else if (typeof mt === 'number' && mt > 0) try { doc.y = (doc.y ?? 0) + mt; } catch (e) { /* ignore */ }

        if (pos === 'top-right') {
          const x = doc.x + (usableWidth - width);
          this.pdfService.embedImageSafe(doc, buf, x, doc.y, { width });
        } else if (pos === 'bottom-right') {
          const x = doc.x + (usableWidth - width);
          // place at current y (template author decided where to place it)
          this.pdfService.embedImageSafe(doc, buf, x, doc.y, { width });
        } else if (pos === 'center' || pos === 'center-bottom' || pos === 'bottom-center') {
          const x = Math.max(marginLeft, Math.floor((doc.page.width - width) / 2));
          this.pdfService.embedImageSafe(doc, buf, x, doc.y, { width });
        } else {
          // default: place at current cursor
          this.pdfService.embedImageSafe(doc, buf, doc.x, doc.y, { width });
        }

        if (typeof mbLines === 'number' && mbLines > 0) doc.moveDown(mbLines);
        else if (typeof mb === 'number' && mb > 0) try { doc.y = (doc.y ?? 0) + mb; } catch (e) { /* ignore */ }

        continue;
      }
      // render non-image elements inline
      if (t !== 'image') this.renderElement(doc, el, ctx, styles);
    }

    this.pdfService.endDocument(doc);
  }

  /**
   * Render a template into an existing PDF document. This does NOT pipe/stream
   * the document or end it; caller is responsible for creating/streaming/ending
   * the PDF. Useful when composing a single PDF with multiple template instances.
   */
  async renderTemplateIntoDocument(doc: any, templateId: string, ctx: Record<string, unknown>) {
    const tpl = await this.loadTemplate(templateId);
    if (!tpl) throw new Error(`Template ${templateId} not found`);

    // pre-load common images
    const images: Record<string, Buffer | undefined> = {};
    for (const v of ['logo', 'signature']) {
      images[v] = await this.loadImageBuffer(ctx, v);
    }

    // render first page elements (templates are simple for now). This will write
    // into the provided doc. Template authors may include image elements which
    // we handle here by embedding the preloaded buffers.
    const page = tpl.pages[0];
    const styles = tpl.styles ?? {};

    for (const el of page.elements) {
      const t = (el as any).type as string;
      if (t === 'image') {
        const elAny = el as any;
        const buf = images[elAny.var];
        if (!buf) continue;
        const width = elAny.width ?? 120;
        const pos = elAny.position ?? 'top-right';
        const marginLeft = doc.page.margins?.left ?? 40;
        const marginRight = doc.page.margins?.right ?? 40;
        const usableWidth = doc.page.width - marginLeft - marginRight;

        // merge style margins if any
        const styleObj = elAny.style ? styles?.[elAny.style] : undefined;
        const mtLines = elAny.marginTopLines ?? (styleObj as any)?.marginTopLines;
        const mt = elAny.marginTop ?? (styleObj as any)?.marginTop;
        const mbLines = elAny.marginBottomLines ?? (styleObj as any)?.marginBottomLines;
        const mb = elAny.marginBottom ?? (styleObj as any)?.marginBottom;

        if (typeof mtLines === 'number' && mtLines > 0) doc.moveDown(mtLines);
        else if (typeof mt === 'number' && mt > 0) try { doc.y = (doc.y ?? 0) + mt; } catch (e) { /* ignore */ }

        if (pos === 'top-right') {
          const x = doc.x + (usableWidth - width);
          this.pdfService.embedImageSafe(doc, buf, x, doc.y, { width });
        } else if (pos === 'bottom-right') {
          const x = doc.x + (usableWidth - width);
          this.pdfService.embedImageSafe(doc, buf, x, doc.y, { width });
        } else if (pos === 'center' || pos === 'center-bottom' || pos === 'bottom-center') {
          const x = Math.max(marginLeft, Math.floor((doc.page.width - width) / 2));
          this.pdfService.embedImageSafe(doc, buf, x, doc.y, { width });
        } else {
          this.pdfService.embedImageSafe(doc, buf, doc.x, doc.y, { width });
        }

        if (typeof mbLines === 'number' && mbLines > 0) doc.moveDown(mbLines);
        else if (typeof mb === 'number' && mb > 0) try { doc.y = (doc.y ?? 0) + mb; } catch (e) { /* ignore */ }

        continue;
      }
      // render non-image elements
      if (t !== 'image') this.renderElement(doc, el, ctx, styles);
    }
  }
}
