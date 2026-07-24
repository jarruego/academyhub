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
    findAll: jest.fn(),
    statsByCourse: jest.fn(),
    statsByCenter: jest.fn(),
    reportRows: jest.fn().mockResolvedValue([]),
  } as any;
  const courseRequestStudentRepository = {
    replaceAll: jest.fn().mockResolvedValue([]),
    findByRequest: jest.fn().mockResolvedValue([]),
    appendRows: jest.fn().mockResolvedValue([{ id: 1 }]),
  } as any;

  const service = new CourseRequestService(courseRequestRepository, courseRequestStudentRepository);
  return { service, courseRequestRepository, courseRequestStudentRepository };
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

  it("el informe delega en el repositorio con los filtros indicados", async () => {
    const { service, courseRequestRepository } = buildService();
    await service.report({ id_company: 3 });
    expect(courseRequestRepository.reportRows).toHaveBeenCalledWith({ id_company: 3 });
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
});
