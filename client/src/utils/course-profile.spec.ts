import { describe, it, expect } from "vitest";
import { getCourseProfile } from "./course-profile";
import { CourseModality } from "../shared/types/course/course-modality.enum";
import { CourseOrigin } from "../shared/types/course/course-origin.enum";
import { CourseFunding } from "../shared/types/course/course-funding.enum";

describe("getCourseProfile", () => {
  it("presencial: oculta Moodle y progreso, muestra finalización", () => {
    const p = getCourseProfile({ modality: CourseModality.PRESENTIAL });
    expect(p.isPresential).toBe(true);
    expect(p.showMoodleSync).toBe(false);
    expect(p.showProgressColumn).toBe(false);
    expect(p.showFinalizedColumn).toBe(true);
  });

  it("online: muestra Moodle y progreso, oculta finalización", () => {
    const p = getCourseProfile({ modality: CourseModality.ONLINE });
    expect(p.isOnline).toBe(true);
    expect(p.showMoodleSync).toBe(true);
    expect(p.showProgressColumn).toBe(true);
    expect(p.showFinalizedColumn).toBe(false);
  });

  it("mixta: se comporta como online a efectos de Moodle/progreso", () => {
    const p = getCourseProfile({ modality: CourseModality.MIXED });
    expect(p.isMixed).toBe(true);
    expect(p.showMoodleSync).toBe(true);
    expect(p.showProgressColumn).toBe(true);
    expect(p.showFinalizedColumn).toBe(false);
  });

  it("origen INAEM activa expediente y preinscripciones", () => {
    const inaem = getCourseProfile({ origin: CourseOrigin.INAEM });
    expect(inaem.isInaem).toBe(true);
    expect(inaem.showExpediente).toBe(true);
    expect(inaem.showPreinscripciones).toBe(true);

    const privada = getCourseProfile({ origin: CourseOrigin.PRIVADA });
    expect(privada.isInaem).toBe(false);
    expect(privada.showExpediente).toBe(false);
    expect(privada.showPreinscripciones).toBe(false);
  });

  it("bonificación: oculta solo en financiación explícita no-FUNDAE; FUNDAE y sin clasificar la muestran", () => {
    expect(getCourseProfile({ funding: CourseFunding.FUNDAE }).showBonificationButton).toBe(true);
    expect(getCourseProfile({ funding: CourseFunding.PRIVADA }).showBonificationButton).toBe(false);
    expect(getCourseProfile({ funding: CourseFunding.PUBLICA }).showBonificationButton).toBe(false);
    // Sin clasificar -> se muestra (la guarda de servidor valida fundae_id).
    expect(getCourseProfile({ funding: null }).showBonificationButton).toBe(true);
  });

  it("normaliza mayúsculas/minúsculas y tolera strings sueltos", () => {
    const p = getCourseProfile({ modality: "presencial", origin: "inaem", funding: "fundae" });
    expect(p.isPresential).toBe(true);
    expect(p.isInaem).toBe(true);
    expect(p.isFundae).toBe(true);
  });

  it("entradas nulas/vacías: todo en estado seguro (sin capacidades especiales)", () => {
    const p = getCourseProfile({ modality: null, origin: undefined, funding: "" });
    expect(p.isPresential).toBe(false);
    expect(p.isInaem).toBe(false);
    expect(p.isFundae).toBe(false);
    // Sin modalidad conocida no es presencial -> por defecto muestra Moodle/progreso
    // (mismo comportamiento que hoy, donde solo 'presencial' se trataba aparte).
    expect(p.showMoodleSync).toBe(true);
    expect(p.showFinalizedColumn).toBe(false);
    // Sin clasificar el botón de bonificación se muestra (permisivo).
    expect(p.showBonificationButton).toBe(true);
    expect(p.showExpediente).toBe(false);
  });
});
