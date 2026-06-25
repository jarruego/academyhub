import { describe, it, expect } from "vitest";
import { getCourseProfile } from "./course-profile";
import { CourseModality } from "../shared/types/course/course-modality.enum";
import { CourseClient } from "../shared/types/course/course-client.enum";
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

  it("cliente INAEM activa expediente y preinscripciones", () => {
    const inaem = getCourseProfile({ client: CourseClient.INAEM });
    expect(inaem.isInaem).toBe(true);
    expect(inaem.showExpediente).toBe(true);
    expect(inaem.showPreinscripciones).toBe(true);

    const otro = getCourseProfile({ client: CourseClient.OTRO });
    expect(otro.isInaem).toBe(false);
    expect(otro.showExpediente).toBe(false);
    expect(otro.showPreinscripciones).toBe(false);
  });

  it("ámbito público/privado se deriva de la financiación, no del cliente", () => {
    const publica = getCourseProfile({ funding: CourseFunding.PUBLICA });
    expect(publica.isPublic).toBe(true);
    expect(publica.isPrivate).toBe(false);

    for (const f of [CourseFunding.FUNDAE, CourseFunding.PRIVADA]) {
      const p = getCourseProfile({ funding: f });
      expect(p.isPrivate).toBe(true);
      expect(p.isPublic).toBe(false);
    }

    // Sin financiación -> ni público ni privado (sin clasificar).
    const sin = getCourseProfile({ client: CourseClient.OTRO });
    expect(sin.isPublic).toBe(false);
    expect(sin.isPrivate).toBe(false);
  });

  it("INAEM online: muestra finalización aunque no sea presencial", () => {
    const p = getCourseProfile({ modality: CourseModality.ONLINE, client: CourseClient.INAEM });
    expect(p.isOnline).toBe(true);
    expect(p.isInaem).toBe(true);
    expect(p.showFinalizedColumn).toBe(true);
    // Sigue siendo online a efectos de Moodle/progreso.
    expect(p.showMoodleSync).toBe(true);
    expect(p.showProgressColumn).toBe(true);
  });

  it("bonificación: oculta solo en financiación explícita no-FUNDAE; FUNDAE y sin clasificar la muestran", () => {
    expect(getCourseProfile({ funding: CourseFunding.FUNDAE }).showBonificationButton).toBe(true);
    expect(getCourseProfile({ funding: CourseFunding.PRIVADA }).showBonificationButton).toBe(false);
    expect(getCourseProfile({ funding: CourseFunding.PUBLICA }).showBonificationButton).toBe(false);
    // Sin clasificar -> se muestra (la guarda de servidor valida fundae_id).
    expect(getCourseProfile({ funding: null }).showBonificationButton).toBe(true);
  });

  it("normaliza mayúsculas/minúsculas y tolera strings sueltos", () => {
    const p = getCourseProfile({ modality: "presencial", client: "inaem", funding: "fundae" });
    expect(p.isPresential).toBe(true);
    expect(p.isInaem).toBe(true);
    expect(p.isFundae).toBe(true);
  });

  it("entradas nulas/vacías: todo en estado seguro (sin capacidades especiales)", () => {
    const p = getCourseProfile({ modality: null, client: undefined, funding: "" });
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
