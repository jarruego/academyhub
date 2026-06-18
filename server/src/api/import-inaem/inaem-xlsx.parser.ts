import * as ExcelJS from "exceljs";
import { ParsedTable } from "./inaem-html-table.parser";

/**
 * Parser del fichero de Acciones del INAEM (.xlsx real). Lee la primera hoja y
 * la devuelve como { headers, rows } con la misma forma que el parser HTML.
 *
 * Nota: el fichero de Acciones tiene la primera columna (Estado) SIN cabecera;
 * a las cabeceras vacías se les asigna el nombre sintético `COL_<n>` (1-indexado),
 * por lo que el Estado queda accesible como `row[headers[0]]` desde el mapeo.
 */

/** Convierte cualquier tipo de celda de exceljs a string. Fechas -> ISO yyyy-mm-dd (UTC). */
function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "object") {
    const v = value as any;
    if (Array.isArray(v.richText)) return v.richText.map((r: any) => r.text).join("");
    if ("text" in v) return String(v.text);
    if ("result" in v) return cellToString(v.result);
    if ("hyperlink" in v) return String(v.hyperlink);
    return "";
  }
  return String(value).trim();
}

export async function parseInaemXlsx(buffer: Buffer): Promise<ParsedTable> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const ws = wb.worksheets[0];
  if (!ws) return { headers: [], rows: [] };

  let headers: string[] = [];
  const rows: Record<string, string>[] = [];

  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as ExcelJS.CellValue[]; // 1-indexado (índice 0 vacío)
    if (!headers.length) {
      const count = values.length - 1;
      headers = [];
      for (let i = 1; i <= count; i++) {
        headers.push(cellToString(values[i]).trim() || `COL_${i}`);
      }
      return;
    }
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = cellToString(values[i + 1]);
    }
    rows.push(obj);
  });

  return { headers, rows };
}
