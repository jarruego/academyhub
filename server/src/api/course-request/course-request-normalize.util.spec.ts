import { normalizeDni, normalizeEmail, normalizePhone, normalizeText } from "./course-request-normalize.util";

describe("normalizeText", () => {
  it("recorta y colapsa espacios internos", () => {
    expect(normalizeText("  Juan   García  ")).toBe("Juan García");
  });
  it("undefined/null -> ''", () => {
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
  });
});

describe("normalizeDni", () => {
  it("mayúsculas y sin guiones/espacios/puntos", () => {
    expect(normalizeDni(" 12345678-a ")).toBe("12345678A");
    expect(normalizeDni("y.9002581 g")).toBe("Y9002581G");
  });
});

describe("normalizeEmail", () => {
  it("minúsculas y sin espacios cuando el formato es válido", () => {
    expect(normalizeEmail(" Juan.Garcia@Example.COM ")).toBe("juan.garcia@example.com");
  });
  it("conserva (sin descartar) un email con formato inválido, solo aseado", () => {
    expect(normalizeEmail("  juan (arroba) example.com  ")).toBe("juan(arroba)example.com");
  });
});

describe("normalizePhone", () => {
  it("quita separadores y conserva el + inicial", () => {
    expect(normalizePhone("+34 600-111.222")).toBe("+34600111222");
    expect(normalizePhone("600 111 222")).toBe("600111222");
  });
});
