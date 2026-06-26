import { isValidDocument } from "./dni.util";

describe("dni.util · isValidDocument", () => {
  it("acepta un DNI con letra correcta", () => {
    expect(isValidDocument("12345678Z")).toBe(true);
    expect(isValidDocument("12345678z")).toBe(true); // case-insensitive
    expect(isValidDocument(" 12345678Z ")).toBe(true); // trim
  });

  it("rechaza un DNI con letra incorrecta", () => {
    expect(isValidDocument("12345678A")).toBe(false);
  });

  it("acepta un NIE con letra correcta", () => {
    expect(isValidDocument("X1234567L")).toBe(true);
    expect(isValidDocument("Z1234567R")).toBe(true);
  });

  it("rechaza un NIE con letra incorrecta", () => {
    expect(isValidDocument("X1234567A")).toBe(false);
  });

  it("rechaza formatos imposibles", () => {
    expect(isValidDocument("1234567Z")).toBe(false); // 7 dígitos
    expect(isValidDocument("123456789")).toBe(false); // sin letra
    expect(isValidDocument("ABCDEFGHI")).toBe(false);
    expect(isValidDocument("A1234567L")).toBe(false); // inicial no XYZ
  });

  it("trata vacío/nulo como inválido", () => {
    expect(isValidDocument("")).toBe(false);
    expect(isValidDocument(null)).toBe(false);
    expect(isValidDocument(undefined)).toBe(false);
  });
});
