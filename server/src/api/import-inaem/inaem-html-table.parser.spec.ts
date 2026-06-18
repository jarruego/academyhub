import { parseInaemHtmlTable } from "./inaem-html-table.parser";
import { parseInaemXlsx } from "./inaem-xlsx.parser";
import { parseInaemFile } from "./inaem-file.parser";
import * as ExcelJS from "exceljs";

describe("parseInaemHtmlTable", () => {
  // Reproduce el formato real del INAEM: latin-1, <tr> sin cerrar, atributos en <th>.
  const sample =
    "<table>\n" +
    '<tr><th>N.Expediente</th><th class="x">NIF/NIE</th><th>NOMBRE</th><th>FINALIZADO</th>\n' +
    "<tr><td>25/0202.001</td><td>Y9002581-G</td><td>Kais</td><td>SI</td>\n" +
    "<tr><td>25/0202.002</td><td>17466016-T</td><td>Ouahib</td><td>NO</td>\n" +
    "</table>\n";

  it("extrae cabeceras y filas con <tr> sin cerrar", () => {
    const buf = Buffer.from(sample, "latin1");
    const { headers, rows } = parseInaemHtmlTable(buf);
    expect(headers).toEqual(["N.Expediente", "NIF/NIE", "NOMBRE", "FINALIZADO"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      "N.Expediente": "25/0202.001",
      "NIF/NIE": "Y9002581-G",
      NOMBRE: "Kais",
      FINALIZADO: "SI",
    });
    expect(rows[1]["FINALIZADO"]).toBe("NO");
  });

  it("decodifica latin-1 (acentos) y entidades HTML", () => {
    const html =
      "<table>\n<tr><th>PROVINCIA</th><th>EMPRESA</th>\n" +
      "<tr><td>ARAGÓN</td><td>Caf&eacute; &amp; T&eacute;</td>\n</table>";
    const { rows } = parseInaemHtmlTable(Buffer.from(html, "latin1"));
    expect(rows[0]["PROVINCIA"]).toBe("ARAGÓN");
    expect(rows[0]["EMPRESA"]).toContain("&");
  });

  it("devuelve vacío si no hay tabla", () => {
    expect(parseInaemHtmlTable(Buffer.from("sin tabla", "latin1"))).toEqual({ headers: [], rows: [] });
  });
});

describe("parseInaemXlsx / parseInaemFile", () => {
  // Genera un xlsx en memoria con la forma de Acciones (1ª columna Estado sin cabecera).
  async function makeAccionesXlsx(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    ws.addRow([null, "N.Exp.", "Curso", "Inicio", "Horas"]);
    ws.addRow(["Cerrado", "25/0202.001", "OPERACIONES", new Date(Date.UTC(2025, 10, 1)), 210]);
    const out = await wb.xlsx.writeBuffer();
    return Buffer.from(out as ArrayBuffer);
  }

  it("lee la primera hoja; cabecera vacía -> COL_1; fechas -> ISO", async () => {
    const { headers, rows } = await parseInaemXlsx(await makeAccionesXlsx());
    expect(headers[0]).toBe("COL_1");
    expect(headers).toContain("N.Exp.");
    expect(rows).toHaveLength(1);
    expect(rows[0]["COL_1"]).toBe("Cerrado");
    expect(rows[0]["N.Exp."]).toBe("25/0202.001");
    expect(rows[0]["Inicio"]).toBe("2025-11-01");
    expect(rows[0]["Horas"]).toBe("210");
  });

  it("parseInaemFile autodetecta xlsx (PK) vs HTML", async () => {
    const xlsx = await parseInaemFile(await makeAccionesXlsx());
    expect(xlsx.rows[0]["N.Exp."]).toBe("25/0202.001");

    const html = await parseInaemFile(
      Buffer.from("<table>\n<tr><th>A</th>\n<tr><td>1</td>\n</table>", "latin1"),
    );
    expect(html.rows[0]["A"]).toBe("1");
  });
});
