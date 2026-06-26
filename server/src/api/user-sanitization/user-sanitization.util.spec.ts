import { detectUserIssues, normalizeValidValue, suggestFix } from "./user-sanitization.util";

describe("user-sanitization.util · detectUserIssues", () => {
  it("ignora campos vacíos o nulos", () => {
    expect(detectUserIssues({})).toEqual([]);
    expect(detectUserIssues({ phone: "", email: null, dni: "  ", nss: undefined })).toEqual([]);
  });

  it("no marca datos válidos y ya normalizados", () => {
    expect(
      detectUserIssues({
        phone: "600123123",
        email: "juan@example.com",
        dni: "12345678Z",
        nss: "281234567840",
      }),
    ).toEqual([]);
  });

  it("teléfono con separadores → auto-corregible a solo dígitos", () => {
    const [issue] = detectUserIssues({ phone: "600 123 123" });
    expect(issue).toMatchObject({ field: "phone", fixable: true, suggestion: "600123123" });
  });

  it("teléfono demasiado corto → no auto-corregible", () => {
    const [issue] = detectUserIssues({ phone: "12345" });
    expect(issue).toMatchObject({ field: "phone", fixable: false, suggestion: null });
  });

  it("email con mayúsculas/espacios → auto-corregible", () => {
    const [issue] = detectUserIssues({ email: " Juan@Example.com " });
    expect(issue).toMatchObject({ field: "email", fixable: true, suggestion: "juan@example.com" });
  });

  it("email con caracteres no permitidos → no auto-corregible", () => {
    const [issue] = detectUserIssues({ email: "juan(at)example.com" });
    expect(issue).toMatchObject({ field: "email", fixable: false, suggestion: null });
  });

  it("DNI con letra incorrecta → no auto-corregible", () => {
    const [issue] = detectUserIssues({ dni: "12345678A" });
    expect(issue).toMatchObject({ field: "dni", fixable: false, suggestion: null });
  });

  it("NSS sin cero a la izquierda → auto-corregible a la forma canónica", () => {
    // "81234567869" (11 dígitos) → "081234567869" con checksum válido (812345678 % 97 = 69)
    const [issue] = detectUserIssues({ nss: "81234567869" });
    expect(issue).toMatchObject({ field: "nss", fixable: true, suggestion: "081234567869" });
  });

  it("NSS con dígito de control imposible → no auto-corregible", () => {
    const [issue] = detectUserIssues({ nss: "281234567841" });
    expect(issue).toMatchObject({ field: "nss", fixable: false, suggestion: null });
  });
});

describe("user-sanitization.util · suggestFix", () => {
  it("devuelve null si el valor ya está saneado", () => {
    expect(suggestFix("phone", "600123123")).toBeNull();
    expect(suggestFix("email", "juan@example.com")).toBeNull();
  });

  it("devuelve null para entradas vacías", () => {
    expect(suggestFix("phone", "   ")).toBeNull();
  });
});

describe("user-sanitization.util · normalizeValidValue", () => {
  it("normaliza valores válidos por campo", () => {
    expect(normalizeValidValue("phone", "600 123 123")).toBe("600123123");
    expect(normalizeValidValue("email", " Juan@Example.com ")).toBe("juan@example.com");
    expect(normalizeValidValue("dni", "12345678z")).toBe("12345678Z");
    expect(normalizeValidValue("nss", "81234567869")).toBe("081234567869");
  });

  it("rechaza (null) valores inválidos", () => {
    expect(normalizeValidValue("phone", "123")).toBeNull();
    expect(normalizeValidValue("email", "juan(at)x.com")).toBeNull();
    expect(normalizeValidValue("dni", "12345678A")).toBeNull();
    expect(normalizeValidValue("nss", "281234567841")).toBeNull();
    expect(normalizeValidValue("dni", "   ")).toBeNull();
  });
});
