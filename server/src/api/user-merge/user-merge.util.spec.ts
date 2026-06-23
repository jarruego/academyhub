import {
  normalizeNss,
  normalizeName,
  earliestDate,
  latestDate,
  maxNum,
  maxDecimal,
  strongerPreinscriptionStatus,
  mergeUserCourseRow,
  mergeUserGroupRow,
  mergePreinscriptionRow,
  MERGEABLE_FIELDS,
} from "./user-merge.util";
import { PreinscriptionStatus } from "src/types/preinscription/preinscription-status.enum";

describe("normalizeNss", () => {
  it("quita ceros a la izquierda y separadores", () => {
    expect(normalizeNss("081358086457")).toBe("81358086457");
    expect(normalizeNss("81358086457")).toBe("81358086457");
    expect(normalizeNss("08/1358086457")).toBe("81358086457");
    expect(normalizeNss(" 08-1358086457 ")).toBe("81358086457");
  });
  it("colapsa el caso real NIE↔DNI (misma persona)", () => {
    expect(normalizeNss("81358086457")).toBe(normalizeNss("081358086457"));
  });
  it("devuelve '' para nulos/vacíos/sin dígitos", () => {
    expect(normalizeNss(null)).toBe("");
    expect(normalizeNss(undefined)).toBe("");
    expect(normalizeNss("")).toBe("");
    expect(normalizeNss("abc")).toBe("");
    expect(normalizeNss("0000")).toBe("");
  });
});

describe("normalizeName", () => {
  it("minúsculas, sin acentos, espacios colapsados", () => {
    expect(normalizeName("CARMEN", "BARRIOS", " SANCHEZ")).toBe("carmen barrios sanchez");
    expect(normalizeName("José", "Núñez", null)).toBe("jose nunez");
  });
  it("ignora partes nulas", () => {
    expect(normalizeName("Ana", null, undefined)).toBe("ana");
  });
});

describe("comparadores de valores", () => {
  it("earliestDate / latestDate respetan nulos", () => {
    const a = new Date("2020-01-01");
    const b = new Date("2021-01-01");
    expect(earliestDate(a, b)).toBe(a);
    expect(latestDate(a, b)).toBe(b);
    expect(earliestDate(null, b)).toBe(b);
    expect(latestDate(a, null)).toBe(a);
  });
  it("maxNum y maxDecimal", () => {
    expect(maxNum(3, 7)).toBe(7);
    expect(maxNum(null, 5)).toBe(5);
    expect(maxNum(4, null)).toBe(4);
    expect(maxDecimal("10.50", "9.99")).toBe("10.50");
    expect(maxDecimal(null, "1.00")).toBe("1.00");
  });
  it("strongerPreinscriptionStatus: MATRICULADO gana a PREINSCRITO", () => {
    expect(strongerPreinscriptionStatus(PreinscriptionStatus.PREINSCRITO, PreinscriptionStatus.MATRICULADO)).toBe(PreinscriptionStatus.MATRICULADO);
    expect(strongerPreinscriptionStatus(PreinscriptionStatus.MATRICULADO, PreinscriptionStatus.BAJA)).toBe(PreinscriptionStatus.MATRICULADO);
    expect(strongerPreinscriptionStatus(PreinscriptionStatus.DESCARTADO, PreinscriptionStatus.BAJA)).toBe(PreinscriptionStatus.BAJA);
  });
});

describe("fusión de filas hijas compartidas", () => {
  it("mergeUserCourseRow toma el mejor progreso y la matrícula más antigua", () => {
    const w = { completion_percentage: "50.00", time_spent: 100, enrollment_date: new Date("2021-01-01"), id_moodle_user: null };
    const l = { completion_percentage: "80.00", time_spent: 30, enrollment_date: new Date("2020-06-01"), id_moodle_user: 9 };
    const r = mergeUserCourseRow(w, l);
    expect(r.completion_percentage).toBe("80.00");
    expect(r.time_spent).toBe(100);
    expect(r.enrollment_date).toEqual(new Date("2020-06-01"));
    expect(r.id_moodle_user).toBe(9);
  });
  it("mergeUserGroupRow hace OR de finalized/is_tutor y conserva id_role", () => {
    const w = { finalized: false, is_tutor: false, id_role: null, id_center: 2, completion_percentage: null, time_spent: null, last_access: new Date("2021-01-01"), join_date: new Date("2021-01-01"), moodle_synced_at: null };
    const l = { finalized: true, is_tutor: true, id_role: 5, id_center: null, completion_percentage: "10.00", time_spent: 20, last_access: new Date("2022-01-01"), join_date: new Date("2020-01-01"), moodle_synced_at: new Date("2022-01-01") };
    const r = mergeUserGroupRow(w, l);
    expect(r.finalized).toBe(true);
    expect(r.is_tutor).toBe(true);
    expect(r.id_role).toBe(5);
    expect(r.id_center).toBe(2);
    expect(r.last_access).toEqual(new Date("2022-01-01"));
    expect(r.join_date).toEqual(new Date("2020-01-01"));
  });
  it("mergePreinscriptionRow conserva el estado más fuerte y OR de prioritaria", () => {
    const w = { status: PreinscriptionStatus.PREINSCRITO, prioritaria: false, preinscription_date: new Date("2021-01-01") };
    const l = { status: PreinscriptionStatus.MATRICULADO, prioritaria: true, preinscription_date: new Date("2020-01-01") };
    const r = mergePreinscriptionRow(w, l);
    expect(r.status).toBe(PreinscriptionStatus.MATRICULADO);
    expect(r.prioritaria).toBe(true);
    expect(r.preinscription_date).toEqual(new Date("2020-01-01"));
  });
});

describe("MERGEABLE_FIELDS", () => {
  it("no incluye id_user ni timestamps de auditoría", () => {
    expect(MERGEABLE_FIELDS).not.toContain("id_user");
    expect(MERGEABLE_FIELDS).not.toContain("createdAt");
    expect(MERGEABLE_FIELDS).not.toContain("updatedAt");
    expect(MERGEABLE_FIELDS).toContain("dni");
    expect(MERGEABLE_FIELDS).toContain("nss");
    expect(MERGEABLE_FIELDS).toContain("email");
  });
});
