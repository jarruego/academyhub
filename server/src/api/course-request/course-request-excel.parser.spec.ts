import * as ExcelJS from "exceljs";
import { parseCourseRequestExcel } from "./course-request-excel.parser";
import { normalizeHeader } from "./course-request-column-map";

async function buildWorkbook(headers: string[], rows: string[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Alta");
  ws.addRow(headers);
  rows.forEach((row) => ws.addRow(row));
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}

describe("normalizeHeader", () => {
  it("quita acentos, pone mayúsculas y colapsa espacios", () => {
    expect(normalizeHeader("Teléfono  Móvil")).toBe("TELEFONO MOVIL");
    expect(normalizeHeader(" correo electrónico ")).toBe("CORREO ELECTRONICO");
  });
});

describe("parseCourseRequestExcel", () => {
  it("detecta columnas por cabecera aunque estén desordenadas e ignora columnas extra", async () => {
    // Orden real de la plantilla: DNI antes que nombre, más columnas CENTRO/MAIL a ignorar.
    const buffer = await buildWorkbook(
      ["DNI", "APELLIDO 1", "CENTRO", "NOMBRE", "APELLIDO 2", "TELÉFONO MÓVIL", "CORREO ELECTRONICO", "MAIL"],
      [
        ["12345678A", "García", "Centro X", "Juan", "López", "600111222", "juan@example.com", "otro@example.com"],
        ["87654321B", "Pérez", "Centro X", "Ana", "", "600333444", "ana@example.com", ""],
      ],
    );

    const { rows, matchedFields } = await parseCourseRequestExcel(buffer);

    expect(matchedFields.sort()).toEqual(
      ["name", "first_surname", "second_surname", "dni", "email", "phone_mobile"].sort(),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      name: "Juan",
      first_surname: "García",
      second_surname: "López",
      dni: "12345678A",
      email: "juan@example.com",
      phone_mobile: "600111222",
    });
    expect(rows[1].second_surname).toBeUndefined();
  });

  it("reconoce AP1/AP2 y, ante dos columnas EMAIL, usa la primera (ignora CENTRO y el email duplicado)", async () => {
    // Variante real: NOMBRE AP1 AP2 DNI email movil centro email (la 2ª "email" es del centro, se ignora).
    const buffer = await buildWorkbook(
      ["NOMBRE", "AP1", "AP2", "DNI", "email", "movil", "centro", "email"],
      [["Juan", "García", "López", "12345678A", "juan@example.com", "600111222", "Centro X", "centro@example.com"]],
    );

    const { rows, matchedFields } = await parseCourseRequestExcel(buffer);

    expect(matchedFields.sort()).toEqual(
      ["name", "first_surname", "second_surname", "dni", "email", "phone_mobile"].sort(),
    );
    expect(rows[0]).toEqual({
      name: "Juan",
      first_surname: "García",
      second_surname: "López",
      dni: "12345678A",
      email: "juan@example.com",
      phone_mobile: "600111222",
    });
  });

  it("omite filas totalmente vacías", async () => {
    const buffer = await buildWorkbook(
      ["NOMBRE", "APELLIDO 1", "DNI", "EMAIL"],
      [
        ["Juan", "García", "12345678A", "juan@example.com"],
        ["", "", "", ""],
      ],
    );
    const { rows } = await parseCourseRequestExcel(buffer);
    expect(rows).toHaveLength(1);
  });

  it("no falla si no reconoce ninguna columna: devuelve filas vacías", async () => {
    const buffer = await buildWorkbook(["A", "B"], [["x", "y"]]);
    const { rows, matchedFields } = await parseCourseRequestExcel(buffer);
    expect(matchedFields).toEqual([]);
    expect(rows).toHaveLength(0);
  });
});
