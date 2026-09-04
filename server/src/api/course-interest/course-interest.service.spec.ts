import { ConflictException, NotFoundException } from "@nestjs/common";
import { CourseInterestService } from "./course-interest.service";
import { CandidateProcessStatus, CandidateSource } from "src/types/course-candidate/course-candidate.enums";
import { InterestStatus } from "src/types/course-interest/course-interest.enums";

describe("CourseInterestService", () => {
  const build = () => {
    const repository = {
      findOpenByUserAndCatalogCourse: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      findByCatalogCourse: jest.fn(),
      findAll: jest.fn(),
      findManyByIds: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      transaction: jest.fn((callback: (transaction: unknown) => unknown) => callback({})),
    } as any;
    const candidateRepository = { upsert: jest.fn(), update: jest.fn() } as any;
    const courseRepository = { findById: jest.fn() } as any;
    return { repository, candidateRepository, courseRepository, service: new CourseInterestService(repository, candidateRepository, courseRepository) };
  };

  it("rechaza crear un interés cuando ya hay uno abierto para la misma persona y curso de catálogo", async () => {
    const { repository, service } = build();
    repository.findOpenByUserAndCatalogCourse.mockResolvedValue({ id_interest: 1 });
    await expect(service.create({ id_user: 11, id_catalog_course: 21 })).rejects.toBeInstanceOf(ConflictException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("crea el interés cuando no hay ninguno abierto", async () => {
    const { repository, service } = build();
    repository.findOpenByUserAndCatalogCourse.mockResolvedValue(undefined);
    repository.create.mockResolvedValue({ id_interest: 2 });
    await service.create({ id_user: 11, id_catalog_course: 21 }, 3);
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ id_user: 11, id_catalog_course: 21, created_by: 3 }));
  });

  it("impide borrar un interés ya incorporado a una edición", async () => {
    const { repository, service } = build();
    repository.findById.mockResolvedValue({ id_interest: 5, status: InterestStatus.CALLED });
    await expect(service.delete(5)).rejects.toBeInstanceOf(ConflictException);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("permite borrar un interés todavía no convocado", async () => {
    const { repository, service } = build();
    repository.findById.mockResolvedValue({ id_interest: 5, status: InterestStatus.INTERESTED });
    repository.delete.mockResolvedValue({ id_interest: 5 });
    await service.delete(5);
    expect(repository.delete).toHaveBeenCalledWith(5);
  });

  describe("updateMany — CONVOCADO/MATRICULADO son estados derivados", () => {
    it("rechaza establecer CONVOCADO a mano", async () => {
      const { repository, service } = build();
      repository.findById.mockResolvedValue({ id_interest: 5, status: InterestStatus.INTERESTED });
      await expect(service.updateMany({ interests: [{ id_interest: 5, status: InterestStatus.CALLED }] })).rejects.toBeInstanceOf(ConflictException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("rechaza establecer MATRICULADO a mano", async () => {
      const { repository, service } = build();
      repository.findById.mockResolvedValue({ id_interest: 5, status: InterestStatus.CALLED });
      await expect(service.updateMany({ interests: [{ id_interest: 5, status: InterestStatus.ENROLLED }] })).rejects.toBeInstanceOf(ConflictException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("rechaza descartar un interés que ya está incorporado a una convocatoria", async () => {
      const { repository, service } = build();
      repository.findById.mockResolvedValue({ id_interest: 5, status: InterestStatus.CALLED });
      await expect(service.updateMany({ interests: [{ id_interest: 5, status: InterestStatus.DISCARDED }] })).rejects.toBeInstanceOf(ConflictException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("permite descartar un interés que todavía no se ha incorporado", async () => {
      const { repository, service } = build();
      repository.findById.mockResolvedValue({ id_interest: 5, status: InterestStatus.CONTACTED });
      repository.update.mockResolvedValue({ id_interest: 5, status: InterestStatus.DISCARDED });
      await service.updateMany({ interests: [{ id_interest: 5, status: InterestStatus.DISCARDED }] });
      expect(repository.update).toHaveBeenCalledWith(5, expect.objectContaining({ status: InterestStatus.DISCARDED, closed_at: expect.any(Date) }), expect.anything());
    });

    it("permite reactivar un interés descartado a INTERESADO", async () => {
      const { repository, service } = build();
      repository.findById.mockResolvedValue({ id_interest: 5, status: InterestStatus.DISCARDED });
      repository.update.mockResolvedValue({ id_interest: 5, status: InterestStatus.INTERESTED });
      await service.updateMany({ interests: [{ id_interest: 5, status: InterestStatus.INTERESTED }] });
      expect(repository.update).toHaveBeenCalledWith(5, expect.objectContaining({ status: InterestStatus.INTERESTED, closed_at: null }), expect.anything());
    });
  });

  describe("incorporate (Incorporar a edición)", () => {
    const course = { id_course: 13, id_catalog_course: 21 };
    const interest = { id_interest: 1, id_user: 11, id_catalog_course: 21, status: InterestStatus.INTERESTED };

    it("crea la candidatura y marca el interés como CONVOCADO", async () => {
      const { repository, candidateRepository, courseRepository, service } = build();
      courseRepository.findById.mockResolvedValue(course);
      repository.findManyByIds.mockResolvedValue([interest]);
      candidateRepository.upsert.mockResolvedValue({ id_candidate: 99, id_interest: 1 });

      await service.incorporate({ id_course: 13, interest_ids: [1] }, 3);

      expect(candidateRepository.upsert).toHaveBeenCalledWith(expect.objectContaining({
        id_user: 11,
        id_course: 13,
        source: CandidateSource.COURSE_INTEREST,
        process_status: CandidateProcessStatus.PENDING,
        id_interest: 1,
        created_by: 3,
      }), expect.anything());
      expect(repository.update).toHaveBeenCalledWith(1, { status: InterestStatus.CALLED }, expect.anything());
    });

    it("rechaza incorporar intereses de un curso de catálogo distinto al de la edición", async () => {
      const { repository, courseRepository, service } = build();
      courseRepository.findById.mockResolvedValue(course);
      repository.findManyByIds.mockResolvedValue([{ ...interest, id_catalog_course: 99 }]);
      await expect(service.incorporate({ id_course: 13, interest_ids: [1] })).rejects.toBeInstanceOf(ConflictException);
    });

    it("rechaza incorporar un interés que ya no está disponible (p. ej. ya CONVOCADO)", async () => {
      const { repository, courseRepository, service } = build();
      courseRepository.findById.mockResolvedValue(course);
      repository.findManyByIds.mockResolvedValue([{ ...interest, status: InterestStatus.CALLED }]);
      await expect(service.incorporate({ id_course: 13, interest_ids: [1] })).rejects.toBeInstanceOf(ConflictException);
    });

    it("rechaza una edición inexistente", async () => {
      const { courseRepository, service } = build();
      courseRepository.findById.mockResolvedValue(undefined);
      await expect(service.incorporate({ id_course: 999, interest_ids: [1] })).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
