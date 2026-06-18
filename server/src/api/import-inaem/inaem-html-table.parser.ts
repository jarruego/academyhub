/**
 * Parser de las exportaciones "xls" del INAEM (Alumnos y Preinscripciones), que
 * en realidad son tablas HTML servidas con extensión .xls. Características del
 * formato observadas: codificación latin-1, `<tr>` SIN cerrar (las filas se
 * separan por la apertura de `<tr>`), celdas `<th>`/`<td>` con atributos.
 *
 * Sin dependencias externas a propósito (estructura simple, sin tablas anidadas).
 */

export interface ParsedTable {
  headers: string[];
  rows: Record<string, string>[];
}

/** Decodifica el buffer: intenta UTF-8 estricto y, si falla, cae a latin-1. */
function decodeBuffer(buffer: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return buffer.toString("latin1");
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&amp;/gi, "&"); // último para no doble-decodificar
}

/** Limpia el contenido de una celda: quita etiquetas internas, decodifica entidades y recorta. */
function cleanCell(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/**
 * Parsea una tabla HTML del INAEM a { headers, rows }. La primera fila es la
 * cabecera; cada fila de datos se devuelve como objeto header -> valor.
 */
export function parseInaemHtmlTable(buffer: Buffer): ParsedTable {
  const content = decodeBuffer(buffer);
  const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

  // Las filas se separan por la apertura de <tr> (pueden no cerrarse).
  const chunks = content.split(/<tr[^>]*>/i);
  const parsedRows: string[][] = [];
  for (const chunk of chunks) {
    const cells: string[] = [];
    let m: RegExpExecArray | null;
    cellRe.lastIndex = 0;
    while ((m = cellRe.exec(chunk)) !== null) {
      cells.push(cleanCell(m[1]));
    }
    if (cells.length) parsedRows.push(cells);
  }

  if (!parsedRows.length) return { headers: [], rows: [] };

  const headers = parsedRows[0].map((h, i) => h || `COL_${i + 1}`);
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < parsedRows.length; r++) {
    const cells = parsedRows[r];
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = cells[c] ?? "";
    }
    rows.push(obj);
  }
  return { headers, rows };
}
