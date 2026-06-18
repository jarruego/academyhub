import { mapInaemEducationLevel } from "./inaem-education-level.util";

describe("mapInaemEducationLevel", () => {
  it("mapea las etiquetas exactas del INAEM a su código FUNDAE", () => {
    const cases: Record<string, string> = {
      "Sin estudios": "1",
      "Estudios primarios": "2",
      "Graduado Escolar": "3",
      ESO: "3",
      "FP I": "3", // criterio acordado
      "BUP/COU Bachillerato": "4",
      "FP II/Ciclo Grado medio": "4", // criterio acordado (no 6)
      "Ciclo Grado Superior": "6",
      Diplomatura: "7",
      Licenciatura: "8",
    };
    for (const [input, expected] of Object.entries(cases)) {
      expect(mapInaemEducationLevel(input)).toBe(expected);
    }
  });

  it("es tolerante a espacios sobrantes y mayúsculas/acentos", () => {
    expect(mapInaemEducationLevel("  fp ii/ciclo grado medio ")).toBe("4");
    expect(mapInaemEducationLevel(" LICENCIATURA")).toBe("8");
  });

  it("valor no listado pero clasificable por palabras clave", () => {
    expect(mapInaemEducationLevel("Doctorado en Física")).toBe("9");
    expect(mapInaemEducationLevel("Máster en Historia")).toBe("8");
  });

  it("valor no clasificable -> defecto 10", () => {
    expect(mapInaemEducationLevel("Curso de cocina creativa")).toBe("10");
  });

  it("vacío -> undefined (no se inventa nivel)", () => {
    expect(mapInaemEducationLevel("")).toBeUndefined();
    expect(mapInaemEducationLevel(null)).toBeUndefined();
    expect(mapInaemEducationLevel(undefined)).toBeUndefined();
  });
});
