import { mapRowToUserFields, buildObservationsForRow, computeUserMerge } from "./inaem-mapping.util";
import { Gender } from "../../types/user/gender.enum";
import { DocumentType } from "../../types/user/document-type.enum";

const baseRow = (over: Record<string, string> = {}): Record<string, string> => ({
  "N.Expediente": "25/0202.001",
  "NIF/NIE": "Y9002581-G",
  APELLIDO1: "AMAMRA",
  APELLIDO2: "",
  NOMBRE: "Kais",
  "DIRECCIÓN": "Coso 87",
  CP: "50001",
  LOCALIDAD: "Zaragoza",
  PROVINCIA: "ZARAGOZA",
  "TELÉFONO MOVIL": "603631226",
  EMAIL: "kais@example.com",
  SEXO: "Hombre",
  "F.NACIMIENTO": "22/11/1999",
  DISCAPACIDAD: "NO",
  ESTUDIOS: "Estudios primarios",
  "DISPONIBILIDAD HORARIA": "Tardes",
  HORARIO: "15",
  ...over,
});

describe("mapRowToUserFields", () => {
  it("mapea campos básicos y sanitiza DNI", () => {
    const f = mapRowToUserFields(baseRow());
    expect(f.dni).toBe("Y9002581G");
    expect(f.document_type).toBe(DocumentType.NIE);
    expect(f.name).toBe("Kais");
    expect(f.first_surname).toBe("AMAMRA");
    expect(f.second_surname).toBeUndefined();
    expect(f.email).toBe("kais@example.com");
    expect(f.phone).toBe("603631226");
    expect(f.gender).toBe(Gender.MALE);
    expect(f.disability).toBe(false);
    expect(f.birth_date?.getUTCFullYear()).toBe(1999);
    expect(f.city).toBe("Zaragoza");
  });

  it("descarta emails con formato inválido", () => {
    expect(mapRowToUserFields(baseRow({ EMAIL: "no-es-email" })).email).toBeUndefined();
  });

  it("usa el teléfono fijo si no hay móvil", () => {
    const f = mapRowToUserFields(baseRow({ "TELÉFONO MOVIL": "", "TELÉFONO FIJO": "976111222" }));
    expect(f.phone).toBe("976111222");
  });
});

describe("buildObservationsForRow", () => {
  it("vuelca sólo los campos de observaciones con valor, bajo cabecera de expediente", () => {
    const obs = buildObservationsForRow("25/0202.001", baseRow({ EMPRESA: "ACME" }));
    expect(obs).toContain("[INAEM 25/0202.001]");
    expect(obs).toContain("DISPONIBILIDAD HORARIA: Tardes");
    expect(obs).toContain("HORARIO: 15");
    expect(obs).toContain("EMPRESA: ACME");
    // No incluye campos vacíos ni campos excluidos
    expect(obs).not.toContain("CIF EMPRESA");
  });
});

describe("computeUserMerge", () => {
  const incoming = mapRowToUserFields(baseRow());

  it("rellena campos vacíos en BD (fill-gaps) sin generar conflicto", () => {
    const { update, conflicts } = computeUserMerge(
      { email: null, phone: null, city: null, gender: "Other", birth_date: null, disability: null },
      incoming,
    );
    expect(update.email).toBe("kais@example.com");
    expect(update.city).toBe("Zaragoza");
    expect(update.gender).toBe(Gender.MALE);
    expect(update.disability).toBe(false);
    expect(conflicts).toHaveLength(0);
  });

  it("detecta conflicto cuando BD tiene un valor distinto (no sobrescribe)", () => {
    const { update, conflicts } = computeUserMerge(
      { email: "otro@distinto.com", city: "Zaragoza" },
      incoming,
    );
    expect(update.email).toBeUndefined(); // no se sobrescribe
    expect(conflicts.find((c) => c.field === "email")).toBeTruthy();
    // city coincide -> ni update ni conflicto
    expect(update.city).toBeUndefined();
    expect(conflicts.find((c) => c.field === "city")).toBeFalsy();
  });
});
