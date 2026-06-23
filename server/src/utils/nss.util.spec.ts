import { nssDigits, isValidNss, canonicalNss, pickValidNss } from "./nss.util";

describe("nss.util", () => {
  // 081358086457: prov 08, nº 13580864, control 57 = 0813580864 mod 97. Válido.
  const VALID = "081358086457";
  const MISSING_ZERO = "81358086457"; // mismo NSS sin el cero (11 díg, no valida)

  describe("nssDigits", () => {
    it("quita separadores y maneja nulos", () => {
      expect(nssDigits("08/1358086457")).toBe(VALID);
      expect(nssDigits(null)).toBe("");
      expect(nssDigits(undefined)).toBe("");
    });
  });

  describe("isValidNss", () => {
    it("acepta un NSS de 12 dígitos con control correcto", () => {
      expect(isValidNss(VALID)).toBe(true);
    });
    it("rechaza el que le falta el cero (11 dígitos)", () => {
      expect(isValidNss(MISSING_ZERO)).toBe(false);
    });
    it("rechaza longitudes/control incorrectos", () => {
      expect(isValidNss("081358086458")).toBe(false); // control mal
      expect(isValidNss("123")).toBe(false);
      expect(isValidNss(null)).toBe(false);
    });
  });

  describe("canonicalNss", () => {
    it("rellena con ceros a la izquierda hasta 12 dígitos", () => {
      expect(canonicalNss(MISSING_ZERO)).toBe(VALID);
      expect(canonicalNss("123")).toBe("000000000123");
    });
    it("deja igual un NSS ya de 12 dígitos", () => {
      expect(canonicalNss(VALID)).toBe(VALID);
    });
    it("preserva null/vacío (no inventa NSS)", () => {
      expect(canonicalNss(null)).toBeNull();
      expect(canonicalNss("")).toBe("");
    });
  });

  describe("pickValidNss", () => {
    it("conserva el válido aunque sea del perdedor (orden a,b)", () => {
      // a = ganador (sin cero, inválido), b = perdedor (válido) → gana el válido
      expect(pickValidNss(MISSING_ZERO, VALID)).toBe(VALID);
      // a = ganador válido, b = perdedor inválido → gana el ganador
      expect(pickValidNss(VALID, MISSING_ZERO)).toBe(VALID);
    });
    it("si ninguno valida, devuelve el primero no vacío en forma canónica", () => {
      expect(pickValidNss("123", "456")).toBe("000000000123");
      expect(pickValidNss(null, "456")).toBe("000000000456");
    });
    it("devuelve null si ambos vacíos", () => {
      expect(pickValidNss(null, "")).toBeNull();
    });
  });
});
