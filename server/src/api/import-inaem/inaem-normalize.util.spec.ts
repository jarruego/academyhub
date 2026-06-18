import {
  cleanText,
  sanitizeDni,
  inferDocumentType,
  parseInaemDate,
  parseGender,
  parseSiNo,
  buildInaemObservationBlock,
  upsertObservationBlock,
} from "./inaem-normalize.util";
import { Gender } from "../../types/user/gender.enum";
import { DocumentType } from "../../types/user/document-type.enum";

describe("inaem-normalize.util", () => {
  describe("sanitizeDni", () => {
    it("quita guiones/espacios/puntos y pone mayúsculas", () => {
      expect(sanitizeDni("Y9002581-G")).toBe("Y9002581G");
      expect(sanitizeDni(" 17466016-t ")).toBe("17466016T");
      expect(sanitizeDni("12.345.678-z")).toBe("12345678Z");
    });
    it("devuelve cadena vacía para null/undefined", () => {
      expect(sanitizeDni(null)).toBe("");
      expect(sanitizeDni(undefined)).toBe("");
    });
  });

  describe("inferDocumentType", () => {
    it("detecta NIE por X/Y/Z inicial", () => {
      expect(inferDocumentType("Y9002581G")).toBe(DocumentType.NIE);
      expect(inferDocumentType("X1234567L")).toBe(DocumentType.NIE);
    });
    it("el resto es DNI", () => {
      expect(inferDocumentType("17466016T")).toBe(DocumentType.DNI);
    });
  });

  describe("parseInaemDate", () => {
    it("parsea dd/mm/yyyy", () => {
      const d = parseInaemDate("22/11/1999")!;
      expect(d.getUTCFullYear()).toBe(1999);
      expect(d.getUTCMonth()).toBe(10);
      expect(d.getUTCDate()).toBe(22);
    });
    it("parsea dd-mm-yyyy e ISO yyyy-mm-dd", () => {
      expect(parseInaemDate("04-01-2024")!.getUTCMonth()).toBe(0);
      const iso = parseInaemDate("2025-11-01")!;
      expect(iso.getUTCFullYear()).toBe(2025);
      expect(iso.getUTCMonth()).toBe(10);
      expect(iso.getUTCDate()).toBe(1);
    });
    it("rechaza vacíos y fechas imposibles", () => {
      expect(parseInaemDate("")).toBeNull();
      expect(parseInaemDate(null)).toBeNull();
      expect(parseInaemDate("31/02/2020")).toBeNull();
      expect(parseInaemDate("no es fecha")).toBeNull();
    });
  });

  describe("parseGender", () => {
    it("mapea Hombre/Mujer", () => {
      expect(parseGender("Hombre")).toBe(Gender.MALE);
      expect(parseGender("mujer")).toBe(Gender.FEMALE);
    });
    it("desconocido -> Other", () => {
      expect(parseGender("")).toBe(Gender.OTHER);
      expect(parseGender("X")).toBe(Gender.OTHER);
    });
  });

  describe("parseSiNo", () => {
    it("SI -> true, NO/vacío -> false", () => {
      expect(parseSiNo("SI")).toBe(true);
      expect(parseSiNo("Sí")).toBe(true);
      expect(parseSiNo("NO")).toBe(false);
      expect(parseSiNo("")).toBe(false);
    });
  });

  describe("cleanText", () => {
    it("recorta y devuelve undefined si queda vacío", () => {
      expect(cleanText("  hola ")).toBe("hola");
      expect(cleanText("   ")).toBeUndefined();
      expect(cleanText(null)).toBeUndefined();
    });
  });

  describe("observation blocks", () => {
    it("construye un bloque acotado por marca de inicio y cierre, sólo con campos con valor", () => {
      const block = buildInaemObservationBlock("25/0202.003", [
        { label: "DISPONIBILIDAD HORARIA", value: "Tardes" },
        { label: "EMPRESA", value: "" },
        { label: "HORARIO", value: "15" },
      ]);
      expect(block).toBe("[INAEM 25/0202.003]\nDISPONIBILIDAD HORARIA: Tardes\nHORARIO: 15\n[/INAEM 25/0202.003]");
    });
    it("devuelve cadena vacía si no hay campos con valor", () => {
      expect(buildInaemObservationBlock("25/0202.003", [{ label: "EMPRESA", value: "" }])).toBe("");
    });
    it("añade un bloque al texto existente preservando lo previo", () => {
      const block = buildInaemObservationBlock("25/0202.003", [{ label: "HORARIO", value: "15" }]);
      const result = upsertObservationBlock("Nota manual previa", "25/0202.003", block);
      expect(result).toBe("Nota manual previa\n\n[INAEM 25/0202.003]\nHORARIO: 15\n[/INAEM 25/0202.003]");
    });
    it("reemplaza el bloque del mismo expediente al reimportar (idempotente)", () => {
      const v1 = upsertObservationBlock("", "25/0202.003", buildInaemObservationBlock("25/0202.003", [{ label: "HORARIO", value: "15" }]));
      const v2 = upsertObservationBlock(v1, "25/0202.003", buildInaemObservationBlock("25/0202.003", [{ label: "HORARIO", value: "16" }]));
      expect(v2).toBe("[INAEM 25/0202.003]\nHORARIO: 16\n[/INAEM 25/0202.003]");
      expect(v2.match(/\[INAEM 25\/0202\.003\]/g)!.length).toBe(1);
    });
    it("mantiene bloques de otros expedientes al reemplazar uno", () => {
      let obs = upsertObservationBlock("", "25/0202.003", buildInaemObservationBlock("25/0202.003", [{ label: "HORARIO", value: "15" }]));
      obs = upsertObservationBlock(obs, "25/0202.007", buildInaemObservationBlock("25/0202.007", [{ label: "HORARIO", value: "8" }]));
      obs = upsertObservationBlock(obs, "25/0202.003", buildInaemObservationBlock("25/0202.003", [{ label: "HORARIO", value: "16" }]));
      expect(obs).toContain("HORARIO: 16");
      expect(obs).toContain("[INAEM 25/0202.007]\nHORARIO: 8\n[/INAEM 25/0202.007]");
      expect(obs.match(/\[INAEM 25\/0202\.003\]/g)!.length).toBe(1);
    });
    it("preserva el texto manual escrito ANTES y DESPUÉS del bloque al reimportar", () => {
      const b1 = buildInaemObservationBlock("25/0202.003", [{ label: "HORARIO", value: "15" }]);
      let obs = upsertObservationBlock("Nota antes", "25/0202.003", b1);
      obs = `${obs}\nNota después`; // el usuario añade texto manual tras el bloque
      const b2 = buildInaemObservationBlock("25/0202.003", [{ label: "HORARIO", value: "16" }]);
      const result = upsertObservationBlock(obs, "25/0202.003", b2);
      expect(result).toContain("Nota antes");
      expect(result).toContain("Nota después"); // <-- el texto manual posterior NO se borra
      expect(result).toContain("HORARIO: 16");
      expect(result).not.toContain("HORARIO: 15");
    });
    it("no toca un bloque ya cerrado si el nuevo import no trae datos para el expediente", () => {
      const b1 = buildInaemObservationBlock("25/0202.003", [{ label: "HORARIO", value: "15" }]);
      const obs = upsertObservationBlock("Nota", "25/0202.003", b1);
      expect(upsertObservationBlock(obs, "25/0202.003", "")).toBe(obs);
    });
    it("cierra un bloque legacy (sin marca de cierre) aunque el nuevo import no traiga datos", () => {
      const legacy = "[INAEM 25/0202.003]\nHORARIO: 15"; // formato antiguo sin cierre
      const result = upsertObservationBlock(legacy, "25/0202.003", "");
      expect(result).toBe("[INAEM 25/0202.003]\nHORARIO: 15\n[/INAEM 25/0202.003]");
    });
    it("cierra un bloque legacy preservando otros bloques posteriores", () => {
      const obs = "[INAEM 25/0202.003]\nHORARIO: 15\n[INAEM 25/0202.007]\nHORARIO: 8\n[/INAEM 25/0202.007]";
      const result = upsertObservationBlock(obs, "25/0202.003", "");
      expect(result).toContain("[INAEM 25/0202.003]\nHORARIO: 15\n[/INAEM 25/0202.003]");
      expect(result).toContain("[INAEM 25/0202.007]\nHORARIO: 8\n[/INAEM 25/0202.007]");
    });
  });
});
