import * as ExcelJS from "exceljs";
import {
  COURSE_REQUEST_STUDENT_COLUMN_ALIASES,
  CourseRequestStudentField,
  normalizeHeader,
} from "./course-request-column-map";

export type ParsedCourseRequestStudentRow = {
  name: string;
  first_surname: string;
  second_surname?: string;
  dni: string;
  email: string;
  phone_mobile?: string;
};

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const v = value as any;
    if (Array.isArray(v.richText)) return v.richText.map((r: any) => r.text).join("");
    if ("text" in v) return String(v.text);
    if ("result" in v) return cellToString(v.result);
    return "";
  }
  return String(value).trim();
}

/** Cabecera -> índice de columna (1-indexado) para cada campo reconocido. */
function matchColumns(headerRow: ExcelJS.CellValue[]): Partial<Record<CourseRequestStudentField, number>> {
  const columns: Partial<Record<CourseRequestStudentField, number>> = {};
  for (let i = 1; i < headerRow.length; i++) {
    const header = normalizeHeader(cellToString(headerRow[i]));
    if (!header) continue;
    for (const [field, aliases] of Object.entries(COURSE_REQUEST_STUDENT_COLUMN_ALIASES)) {
      const key = field as CourseRequestStudentField;
      if (columns[key] !== undefined) continue; // primera columna que matchea gana
      if (aliases.includes(header)) columns[key] = i;
    }
  }
  return columns;
}

/**
 * Lee la primera hoja de un Excel de alta de alumnos. Detecta columnas por
 * nombre de cabecera (con alias), ignora columnas no reconocidas y filas
 * totalmente vacías. No valida obligatoriedad de campos (lo hace el DTO al
 * guardar).
 */
export async function parseCourseRequestExcel(buffer: Buffer): Promise<{
  rows: ParsedCourseRequestStudentRow[];
  matchedFields: CourseRequestStudentField[];
}> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const ws = wb.worksheets[0];
  if (!ws) return { rows: [], matchedFields: [] };

  let columns: Partial<Record<CourseRequestStudentField, number>> | undefined;
  const rows: ParsedCourseRequestStudentRow[] = [];

  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as ExcelJS.CellValue[];
    if (!columns) {
      columns = matchColumns(values);
      return;
    }
    const get = (field: CourseRequestStudentField): string => {
      const idx = columns![field];
      return idx === undefined ? "" : cellToString(values[idx]);
    };
    const name = get("name");
    const first_surname = get("first_surname");
    const second_surname = get("second_surname");
    const dni = get("dni");
    const email = get("email");
    const phone_mobile = get("phone_mobile");
    if (!name && !first_surname && !dni && !email) return; // fila vacía
    rows.push({
      name,
      first_surname,
      second_surname: second_surname || undefined,
      dni,
      email,
      phone_mobile: phone_mobile || undefined,
    });
  });

  return { rows, matchedFields: Object.keys(columns ?? {}) as CourseRequestStudentField[] };
}
