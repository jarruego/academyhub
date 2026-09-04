import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { CourseCandidateService } from "./course-candidate.service";
import { CandidateProcessStatus } from "src/types/course-candidate/course-candidate.enums";
import { InterestStatus } from "src/types/course-interest/course-interest.enums";

describe("CourseCandidateService", () => {
  const candidate = { id_candidate: 7, id_user: 11, id_course: 13, process_status: CandidateProcessStatus.PENDING, id_interest: null };
  const repository = {
    findById: jest.fn(),
    findByCourse: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
    transaction: jest.fn((callback: (transaction: unknown) => unknown) => callback({})),
  } as any;
  const preinscriptions = { findByUserCourse: jest.fn(), deleteByUserCourse: jest.fn() } as any;
  const interests = { findById: jest.fn(), create: jest.fn(), update: jest.fn() } as any;
  const courses = { findById: jest.fn() } as any;
  const users = { create: jest.fn() } as any;
  const service = new CourseCandidateService(repository, preinscriptions, interests, courses, users);

  beforeEach(() => jest.clearAllMocks());

  describe("create", () => {
    it("crea la candidatura directamente cuando ya hay id_user", async () => {
      repository.upsert.mockResolvedValue({ id_candidate: 7 });
      repository.findByCourse.mockResolvedValue([{ id_candidate: 7, id_user: 11 }]);

      const result = await service.create({ id_user: 11, id_course: 13 });

      expect(users.create).not.toHaveBeenCalled();
      expect(repository.upsert).toHaveBeenCalledWith(expect.objectContaining({ id_user: 11, id_course: 13 }));
      expect(result).toMatchObject({ id_candidate: 7 });
    });

    it("crea el usuario y la candidatura cuando no hay id_user", async () => {
      users.create.mockResolvedValue({ insertId: 55 });
      repository.upsert.mockResolvedValue({ id_candidate: 8 });
      repository.findByCourse.mockResolvedValue([{ id_candidate: 8, id_user: 55 }]);

      await service.create({ id_course: 13, new_user: { name: "María", phone: "600111222" } });

      expect(users.create).toHaveBeenCalledWith({ name: "María", first_surname: null, second_surname: null, dni: null, phone: "600111222", email: null });
      expect(repository.upsert).toHaveBeenCalledWith(expect.objectContaining({ id_user: 55, id_course: 13 }));
    });

    it("pasa apellidos y dni al crear el usuario nuevo si se indican", async () => {
      users.create.mockResolvedValue({ insertId: 56 });
      repository.upsert.mockResolvedValue({ id_candidate: 9 });
      repository.findByCourse.mockResolvedValue([{ id_candidate: 9, id_user: 56 }]);

      await service.create({ id_course: 13, new_user: { name: "María", first_surname: "García", second_surname: "López", dni: "12345678Z", phone: "600111222" } });

      expect(users.create).toHaveBeenCalledWith({ name: "María", first_surname: "García", second_surname: "López", dni: "12345678Z", phone: "600111222", email: null });
    });

    it("rechaza crear un candidato nuevo sin nombre", async () => {
      await expect(service.create({ id_course: 13, new_user: { phone: "600111222" } } as any)).rejects.toBeInstanceOf(BadRequestException);
      expect(users.create).not.toHaveBeenCalled();
    });

    it("rechaza crear un candidato nuevo sin teléfono ni email", async () => {
      await expect(service.create({ id_course: 13, new_user: { name: "María" } })).rejects.toBeInstanceOf(BadRequestException);
      expect(users.create).not.toHaveBeenCalled();
    });
  });

  it("impide borrar una candidatura que representa una preinscripción oficial", async () => {
    repository.findById.mockResolvedValue(candidate);
    preinscriptions.findByUserCourse = jest.fn().mockResolvedValue({ status: "PREINSCRITO" });
    await expect(service.delete(7)).rejects.toBeInstanceOf(ConflictException);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("con force=true borra igualmente una candidatura preinscrita, y también la preinscripción oficial", async () => {
    repository.findById.mockResolvedValue(candidate);
    repository.delete.mockResolvedValue(candidate);
    preinscriptions.findByUserCourse = jest.fn().mockResolvedValue({ status: "PREINSCRITO" });

    await service.delete(7, true);

    expect(preinscriptions.deleteByUserCourse).toHaveBeenCalledWith(11, 13, expect.anything());
    expect(repository.delete).toHaveBeenCalledWith(7, expect.anything());
  });

  it("con force=true no toca la preinscripción si no existía ninguna", async () => {
    repository.findById.mockResolvedValue(candidate);
    repository.delete.mockResolvedValue(candidate);
    preinscriptions.findByUserCourse = jest.fn().mockResolvedValue(undefined);

    await service.delete(7, true);

    expect(preinscriptions.deleteByUserCourse).not.toHaveBeenCalled();
    expect(repository.delete).toHaveBeenCalledWith(7, expect.anything());
  });

  it("borra una candidatura manual sin interés de origen sin tocar intereses", async () => {
    preinscriptions.findByUserCourse = jest.fn().mockResolvedValue(undefined);
    repository.findById.mockResolvedValue(candidate);
    repository.delete.mockResolvedValue(candidate);
    await service.delete(7);
    expect(interests.update).not.toHaveBeenCalled();
    expect(repository.delete).toHaveBeenCalledWith(7, expect.anything());
  });

  it("reabre el interés de origen a CONTACTADO al borrar la candidatura vinculada", async () => {
    preinscriptions.findByUserCourse = jest.fn().mockResolvedValue(undefined);
    const withInterest = { ...candidate, id_interest: 55 };
    repository.findById.mockResolvedValue(withInterest);
    repository.delete.mockResolvedValue(withInterest);
    interests.findById.mockResolvedValue({ id_interest: 55, notes: null });

    await service.delete(7);

    expect(interests.update).toHaveBeenCalledWith(55, expect.objectContaining({
      status: InterestStatus.CONTACTED,
      closed_at: null,
      notes: expect.stringContaining("candidatura eliminada"),
    }), expect.anything());
    expect(repository.delete).toHaveBeenCalledWith(7, expect.anything());
  });

  describe("sincronización del interés al cambiar el proceso (fase 3)", () => {
    const course = { id_course: 13, id_catalog_course: 21, course_name: "Manipulador de alimentos", file_number: "25/0202.006" };

    it("reabre el interés de origen a CONTACTADO cuando la candidatura pasa a DESCARTADA", async () => {
      const withInterest = { ...candidate, id_interest: 55 };
      repository.findById.mockResolvedValue(withInterest);
      repository.update.mockResolvedValue({ ...withInterest, process_status: CandidateProcessStatus.NOT_SELECTED });
      courses.findById.mockResolvedValue(course);
      interests.findById.mockResolvedValue({ id_interest: 55, notes: null });

      await service.updateMany({ candidates: [{ id_candidate: 7, process_status: CandidateProcessStatus.NOT_SELECTED }] });

      expect(interests.update).toHaveBeenCalledWith(55, expect.objectContaining({
        status: InterestStatus.CONTACTED,
        closed_at: null,
        notes: expect.stringContaining("Descartada"),
      }), expect.anything());
    });

    it("crea un interés nuevo cuando la candidatura descartada no tenía uno de origen", async () => {
      repository.findById.mockResolvedValue(candidate);
      repository.update.mockResolvedValue({ ...candidate, process_status: CandidateProcessStatus.NOT_SELECTED });
      courses.findById.mockResolvedValue(course);
      interests.create.mockResolvedValue({ id_interest: 99 });

      await service.updateMany({ candidates: [{ id_candidate: 7, process_status: CandidateProcessStatus.NOT_SELECTED }] });

      expect(interests.create).toHaveBeenCalledWith(expect.objectContaining({
        id_catalog_course: 21,
        id_user: 11,
        status: InterestStatus.CONTACTED,
      }), expect.anything());
      expect(repository.update).toHaveBeenCalledWith(7, { id_interest: 99 }, expect.anything());
    });

    it.each([
      ["SELECCIONADA", CandidateProcessStatus.SELECTED],
      ["RESERVA", CandidateProcessStatus.RESERVE],
      ["BAJA", CandidateProcessStatus.WITHDRAWN],
    ])("no reabre nada cuando la candidatura pasa a %s", async (_label, status) => {
      repository.findById.mockResolvedValue({ ...candidate, id_interest: 55 });
      repository.update.mockResolvedValue({});

      await service.updateMany({ candidates: [{ id_candidate: 7, process_status: status }] });

      expect(interests.update).not.toHaveBeenCalled();
      expect(interests.create).not.toHaveBeenCalled();
    });
  });
});
