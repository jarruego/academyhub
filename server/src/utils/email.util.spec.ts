import { sanitizeEmail } from "./email.util";

describe("email.util", () => {
  describe("sanitizeEmail", () => {
    it("pasa a minúsculas y recorta espacios externos", () => {
      expect(sanitizeEmail("  Juan.Perez@Empresa.COM ")).toBe("juan.perez@empresa.com");
    });
    it("quita espacios internos", () => {
      expect(sanitizeEmail("juan perez@empresa.com")).toBe("juanperez@empresa.com");
    });
    it("transectoriza acentos/diacríticos a ASCII", () => {
      expect(sanitizeEmail("josé.pérez@empresa.com")).toBe("jose.perez@empresa.com");
      expect(sanitizeEmail("niño@correo.es")).toBe("nino@correo.es");
      expect(sanitizeEmail("müller@correo.de")).toBe("muller@correo.de");
    });
    it("acepta los símbolos válidos del set local (. _ % + -)", () => {
      expect(sanitizeEmail("a.b_c%d+e-f@dom.com")).toBe("a.b_c%d+e-f@dom.com");
    });
    it("descarta símbolos no permitidos", () => {
      expect(sanitizeEmail("juan(test)@gmail.com")).toBeUndefined();
      expect(sanitizeEmail("a,b;c@dominio.com")).toBeUndefined();
      expect(sanitizeEmail("maria<>@x.es")).toBeUndefined();
    });
    it("descarta estructuras inválidas", () => {
      expect(sanitizeEmail("sin-arroba.com")).toBeUndefined();
      expect(sanitizeEmail("falta@dominio")).toBeUndefined(); // sin TLD
      expect(sanitizeEmail("doble@@x.com")).toBeUndefined();
    });
    it("vacíos/null/undefined -> undefined", () => {
      expect(sanitizeEmail(null)).toBeUndefined();
      expect(sanitizeEmail(undefined)).toBeUndefined();
      expect(sanitizeEmail("   ")).toBeUndefined();
    });
  });
});
