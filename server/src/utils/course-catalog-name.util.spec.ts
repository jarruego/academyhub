import { normalizeCourseCatalogName } from "./course-catalog-name.util";

describe("normalizeCourseCatalogName", () => {
  it("normaliza acentos, mayúsculas y espacios para evitar duplicados", () => {
    expect(normalizeCourseCatalogName("  Manipulación   de alimentos ")).toBe("MANIPULACION DE ALIMENTOS");
  });
});
