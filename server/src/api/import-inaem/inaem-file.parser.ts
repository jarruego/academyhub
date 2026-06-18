import { ParsedTable, parseInaemHtmlTable } from "./inaem-html-table.parser";
import { parseInaemXlsx } from "./inaem-xlsx.parser";

/**
 * Detecta el formato del fichero por sus primeros bytes y delega en el parser
 * adecuado: xlsx real (cabecera ZIP "PK") -> exceljs; en caso contrario se
 * trata como tabla HTML latin-1 (las exportaciones .xls del INAEM).
 */
export async function parseInaemFile(buffer: Buffer): Promise<ParsedTable> {
  const isZip = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b; // "PK"
  return isZip ? parseInaemXlsx(buffer) : Promise.resolve(parseInaemHtmlTable(buffer));
}
