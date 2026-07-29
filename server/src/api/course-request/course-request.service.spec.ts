import { ConflictException, NotFoundException } from "@nestjs/common";
import { CourseRequestService } from "./course-request.service";
import { CourseRequestStatus } from "src/types/course-request/course-request-status.enum";

function buildService({ status = CourseRequestStatus.ABIERTA }: { status?: CourseRequestStatus } = {}) {
  const header = { id_request: 1, status, id_course: 5, id_center: 2 };
  const courseRequestRepository = {
    findById: jest.fn().mockResolvedValue(header),
    update: jest.fn().mockResolvedValue({ ...header }),
    create: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
    findAll: jest.fn().mockResolvedValue([]),
    reportRows: jest.fn().mockResolvedValue([]),
  } as any;
  const courseRequestStudentRepository = {
    replaceAll: jest.fn().mockResolvedValue([]),
    findByRequest: jest.fn().mockResolvedValue([]),
    appendRows: jest.fn().mockResolvedValue([{ id: 1 }]),
    assignGroup: jest.fn().mockResolvedValue([]),
    releaseGroup: jest.fn().mockResolvedValue({}),
    findAssignedByRequests: jest.fn().mockResolvedValue([]),
  } as any;
  const userGroupRepository = {
    findActiveDnisByGroups: jest.fn().mockResolvedValue([]),
  } as any;

  const service = new CourseRequestService(courseRequestRepository, courseRequestStudentRepository, userGroupRepository);
  return { service, courseRequestRepository, courseRequestStudentRepository, userGroupRepository };
}

describe("CourseRequestService", () => {
  it("lanza NotFoundException si la petición no existe", async () => {
    const { service, courseRequestRepository } = buildService();
    courseRequestRepository.findById.mockResolvedValue(undefined);
    await expect(service.findById(999)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("guarda las filas de alumnos sustituyendo las anteriores", async () => {
    const { service, courseRequestStudentRepository } = buildService();
    const students = [
      { name: "Juan", first_surname: "García", dni: "12345678A", email: "juan@example.com" },
    ] as any;
    await service.saveStudents(1, students);
    expect(courseRequestStudentRepository.replaceAll).toHaveBeenCalledWith(1, [
      {
        name: "Juan",
        first_surname: "García",
        second_surname: null,
        dni: "12345678A",
        email: "juan@example.com",
        phone_mobile: null,
      },
    ]);
  });

  it("guarda filas con datos incompletos/inválidos sin bloquear (rellena huecos con '')", async () => {
    const { service, courseRequestStudentRepository } = buildService();
    const students = [{ name: "Juan", email: "no-es-un-email" }] as any;
    await service.saveStudents(1, students);
    expect(courseRequestStudentRepository.replaceAll).toHaveBeenCalledWith(1, [
      {
        name: "Juan",
        first_surname: "",
        second_surname: null,
        dni: "",
        email: "no-es-un-email",
        phone_mobile: null,
      },
    ]);
  });

  it("bloquea editar alumnos de una petición cerrada", async () => {
    const { service } = buildService({ status: CourseRequestStatus.CERRADA });
    await expect(service.saveStudents(1, [])).rejects.toBeInstanceOf(ConflictException);
  });

  it("bloquea editar la cabecera de una petición cerrada", async () => {
    const { service } = buildService({ status: CourseRequestStatus.CERRADA });
    await expect(service.update(1, { notes: "x" })).rejects.toBeInstanceOf(ConflictException);
  });

  it("cierra una petición abierta", async () => {
    const { service, courseRequestRepository } = buildService();
    await service.close(1);
    expect(courseRequestRepository.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: CourseRequestStatus.CERRADA }),
    );
  });

  it("reabre una petición cerrada", async () => {
    const { service, courseRequestRepository } = buildService({ status: CourseRequestStatus.CERRADA });
    await service.reopen(1);
    expect(courseRequestRepository.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: CourseRequestStatus.ABIERTA, closed_at: null }),
    );
  });

  it("el informe delega en el repositorio con los filtros indicados (empresa admite varias)", async () => {
    const { service, courseRequestRepository } = buildService();
    await service.report({ id_company: [3, 5] });
    expect(courseRequestRepository.reportRows).toHaveBeenCalledWith({ id_company: [3, 5] });
  });

  it("duplica cabecera y alumnos como una petición nueva (ABIERTA, sin urgente ni fecha original)", async () => {
    const { service, courseRequestRepository, courseRequestStudentRepository } = buildService();
    courseRequestRepository.findById
      .mockResolvedValueOnce({
        id_request: 1,
        status: CourseRequestStatus.CERRADA,
        id_course: 5,
        id_center: 2,
        contact_email: "a@b.com",
        notes: "nota",
        is_urgent: true,
      })
      .mockResolvedValueOnce({
        id_request: 9,
        status: CourseRequestStatus.ABIERTA,
        id_course: 5,
        id_center: 2,
        contact_email: "a@b.com",
        notes: "nota",
        is_urgent: false,
      });
    courseRequestStudentRepository.findByRequest
      .mockResolvedValueOnce([
        { id: 1, id_request: 1, row_order: 0, name: "Juan", first_surname: "García", second_surname: null, dni: "12345678A", email: "juan@example.com", phone_mobile: null },
      ])
      .mockResolvedValueOnce([]);
    courseRequestRepository.create.mockResolvedValue({ id_request: 9 });

    const result = await service.duplicate(1, 42);

    expect(courseRequestRepository.create).toHaveBeenCalledWith({
      id_center: 2,
      id_course: 5,
      contact_email: "a@b.com",
      notes: "nota",
      created_by: 42,
    });
    expect(courseRequestStudentRepository.appendRows).toHaveBeenCalledWith(9, [
      { name: "Juan", first_surname: "García", second_surname: null, dni: "12345678A", email: "juan@example.com", phone_mobile: null },
    ]);
    expect(result.id_request).toBe(9);
  });

  it("duplicar una petición sin alumnos no llama a appendRows", async () => {
    const { service, courseRequestRepository, courseRequestStudentRepository } = buildService();
    courseRequestRepository.create.mockResolvedValue({ id_request: 9 });
    await service.duplicate(1);
    expect(courseRequestStudentRepository.appendRows).not.toHaveBeenCalled();
  });

  it("subir excel marca la petición como origen EXCEL", async () => {
    const { service, courseRequestRepository, courseRequestStudentRepository } = buildService();
    // Excel mínimo válido generado en memoria (una fila reconocible).
    const ExcelJS = require("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Alta");
    ws.addRow(["NOMBRE", "APELLIDO 1", "DNI", "EMAIL"]);
    ws.addRow(["Juan", "García", "12345678A", "juan@example.com"]);
    const buffer = await wb.xlsx.writeBuffer();

    await service.uploadExcel(1, Buffer.from(buffer));
    expect(courseRequestStudentRepository.appendRows).toHaveBeenCalled();
    expect(courseRequestRepository.update).toHaveBeenCalledWith(1, { source: "EXCEL" });
  });

  it("asigna alumnos a un grupo sin cerrar la petición si quedan alumnos sin asignar", async () => {
    const { service, courseRequestRepository, courseRequestStudentRepository } = buildService();
    courseRequestStudentRepository.findByRequest.mockResolvedValue([
      { id: 1, id_group: 10 },
      { id: 2, id_group: null },
    ]);

    await service.assignStudentsToGroup(1, 10, [1]);

    expect(courseRequestStudentRepository.assignGroup).toHaveBeenCalledWith(1, [1], 10);
    expect(courseRequestRepository.update).not.toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: CourseRequestStatus.CERRADA }),
    );
  });

  it("cierra automáticamente la petición cuando todos sus alumnos quedan asignados a un grupo", async () => {
    const { service, courseRequestRepository, courseRequestStudentRepository } = buildService();
    courseRequestStudentRepository.findByRequest.mockResolvedValue([
      { id: 1, id_group: 10 },
      { id: 2, id_group: 11 },
    ]);

    await service.assignStudentsToGroup(1, 11, [2]);

    expect(courseRequestRepository.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: CourseRequestStatus.CERRADA }),
    );
  });

  it("bloquea asignar alumnos a un grupo si la petición ya está cerrada", async () => {
    const { service } = buildService({ status: CourseRequestStatus.CERRADA });
    await expect(service.assignStudentsToGroup(1, 10, [1])).rejects.toBeInstanceOf(ConflictException);
  });

  it("marca currently_in_group calculándolo al vuelo (sin flag guardado)", async () => {
    const { service, courseRequestStudentRepository, userGroupRepository } = buildService();
    courseRequestStudentRepository.findByRequest.mockResolvedValue([
      { id: 1, id_request: 1, id_group: 10, dni: "12345678A" },
      { id: 2, id_request: 1, id_group: 10, dni: "87654321B" },
      { id: 3, id_request: 1, id_group: null, dni: "11111111C" },
    ]);
    userGroupRepository.findActiveDnisByGroups.mockResolvedValue([{ id_group: 10, dni: "12345678-A" }]);

    const result = await service.findById(1);

    expect(userGroupRepository.findActiveDnisByGroups).toHaveBeenCalledWith([10]);
    expect(result.students.map((s: any) => s.currently_in_group)).toEqual([true, false, false]);
    expect(result.in_group_student_count).toBe(1);
  });

  it("findAll calcula in_group_student_count por petición cruzando por DNI contra el grupo real", async () => {
    const { service, courseRequestRepository, courseRequestStudentRepository, userGroupRepository } = buildService();
    courseRequestRepository.findAll.mockResolvedValue([
      { id_request: 1, status: CourseRequestStatus.ABIERTA, student_count: 4 },
      { id_request: 2, status: CourseRequestStatus.CERRADA, student_count: 2 },
    ]);
    courseRequestStudentRepository.findAssignedByRequests.mockResolvedValue([
      { id_request: 1, id_group: 10, dni: "12345678A" },
      { id_request: 1, id_group: 10, dni: "87654321B" },
      { id_request: 2, id_group: 20, dni: "11111111C" },
    ]);
    // Solo el primer alumno de la petición 1 sigue realmente en el grupo 10;
    // el de la petición 2 ya no está en el 20 (dado de baja, sin liberar).
    userGroupRepository.findActiveDnisByGroups.mockResolvedValue([{ id_group: 10, dni: "12345678A" }]);

    const result = await service.findAll({});

    expect(courseRequestStudentRepository.findAssignedByRequests).toHaveBeenCalledWith([1, 2]);
    expect(result.map((r: any) => r.in_group_student_count)).toEqual([1, 0]);
  });

  it("findAll con listado vacío no llama a findAssignedByRequests", async () => {
    const { service, courseRequestRepository, courseRequestStudentRepository } = buildService();
    courseRequestRepository.findAll.mockResolvedValue([]);
    const result = await service.findAll({});
    expect(result).toEqual([]);
    expect(courseRequestStudentRepository.findAssignedByRequests).not.toHaveBeenCalled();
  });

  it("libera a un alumno que ya no está en el grupo", async () => {
    const { service, courseRequestStudentRepository, userGroupRepository } = buildService();
    courseRequestStudentRepository.findByRequest.mockResolvedValue([
      { id: 1, id_request: 1, id_group: 10, dni: "12345678A" },
    ]);
    userGroupRepository.findActiveDnisByGroups.mockResolvedValue([]);

    await service.releaseStudentGroup(1, 1);

    expect(courseRequestStudentRepository.releaseGroup).toHaveBeenCalledWith(1, 1);
  });

  it("bloquea liberar a un alumno que sigue realmente en el grupo", async () => {
    const { service, courseRequestStudentRepository, userGroupRepository } = buildService();
    courseRequestStudentRepository.findByRequest.mockResolvedValue([
      { id: 1, id_request: 1, id_group: 10, dni: "12345678A" },
    ]);
    userGroupRepository.findActiveDnisByGroups.mockResolvedValue([{ id_group: 10, dni: "12345678A" }]);

    await expect(service.releaseStudentGroup(1, 1)).rejects.toBeInstanceOf(ConflictException);
    expect(courseRequestStudentRepository.releaseGroup).not.toHaveBeenCalled();
  });

  it("bloquea liberar a un alumno que no está asignado a ningún grupo", async () => {
    const { service, courseRequestStudentRepository } = buildService();
    courseRequestStudentRepository.findByRequest.mockResolvedValue([
      { id: 1, id_request: 1, id_group: null, dni: "12345678A" },
    ]);
    await expect(service.releaseStudentGroup(1, 1)).rejects.toBeInstanceOf(ConflictException);
  });
});
