import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CourseRequestFilters,
  CourseRequestRepository,
  CourseRequestStudentRepository,
} from "src/database/repository/course-request/course-request.repository";
import { CreateCourseRequestDto } from "./dto/create-course-request.dto";
import { UpdateCourseRequestDto } from "./dto/update-course-request.dto";
import { CourseRequestStudentDto } from "./dto/course-request-student.dto";
import { parseCourseRequestExcel } from "./course-request-excel.parser";
import { CourseRequestStatus } from "src/types/course-request/course-request-status.enum";
import { CourseRequestSource } from "src/types/course-request/course-request-source.enum";

function isForeignKeyViolation(error: unknown): boolean {
  return (error as { code?: string })?.code === "23503";
}

@Injectable()
export class CourseRequestService {
  constructor(
    private readonly courseRequestRepository: CourseRequestRepository,
    private readonly courseRequestStudentRepository: CourseRequestStudentRepository,
  ) {}

  async create(dto: CreateCourseRequestDto, createdBy?: number) {
    try {
      return await this.courseRequestRepository.create({
        id_center: dto.id_center ?? null,
        id_course: dto.id_course,
        // Si no se indica, la columna usa su default (fecha de alta).
        ...(dto.request_date ? { request_date: new Date(dto.request_date) } : {}),
        contact_email: dto.contact_email ?? null,
        notes: dto.notes ?? null,
        created_by: createdBy ?? null,
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException("El centro o el curso indicados no existen.");
      }
      throw error;
    }
  }

  async findAll(filters: CourseRequestFilters) {
    return this.courseRequestRepository.findAll(filters);
  }

  async stats() {
    const [byCourse, byCenter] = await Promise.all([
      this.courseRequestRepository.statsByCourse(),
      this.courseRequestRepository.statsByCenter(),
    ]);
    return { byCourse, byCenter };
  }

  /** Filas del informe empresa/centro/curso, filtrable por cualquier combinación de los tres. */
  async report(filters: { id_company?: number; id_center?: number; id_course?: number }) {
    return this.courseRequestRepository.reportRows(filters);
  }

  async findById(id_request: number) {
    const header = await this.courseRequestRepository.findById(id_request);
    if (!header) throw new NotFoundException("Petición no encontrada.");
    const students = await this.courseRequestStudentRepository.findByRequest(id_request);
    return { ...header, students };
  }

  private async ensureExists(id_request: number) {
    const header = await this.courseRequestRepository.findById(id_request);
    if (!header) throw new NotFoundException("Petición no encontrada.");
    return header;
  }

  private ensureOpen(header: { status: string }) {
    if (header.status === CourseRequestStatus.CERRADA) {
      throw new ConflictException("La petición está cerrada; reábrela antes de editarla.");
    }
  }

  async update(id_request: number, dto: UpdateCourseRequestDto) {
    const header = await this.ensureExists(id_request);
    this.ensureOpen(header);
    const { request_date, ...rest } = dto;
    try {
      return await this.courseRequestRepository.update(id_request, {
        ...rest,
        ...(request_date ? { request_date: new Date(request_date) } : {}),
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException("El centro o el curso indicados no existen.");
      }
      throw error;
    }
  }

  async saveStudents(id_request: number, students: CourseRequestStudentDto[]) {
    const header = await this.ensureExists(id_request);
    this.ensureOpen(header);
    // No se bloquea el guardado por datos incompletos/inválidos (el aviso es
    // visual, en el cliente); las columnas NOT NULL de la tabla admiten ''.
    const rows = students.map((s) => ({
      name: s.name ?? "",
      first_surname: s.first_surname ?? "",
      second_surname: s.second_surname ?? null,
      dni: s.dni ?? "",
      email: s.email ?? "",
      phone_mobile: s.phone_mobile ?? null,
    }));
    return this.courseRequestStudentRepository.replaceAll(id_request, rows);
  }

  async uploadExcel(id_request: number, buffer: Buffer) {
    const header = await this.ensureExists(id_request);
    this.ensureOpen(header);
    const { rows, matchedFields } = await parseCourseRequestExcel(buffer);
    if (!rows.length) {
      throw new BadRequestException("El Excel no contiene filas de alumnos reconocibles.");
    }
    const inserted = await this.courseRequestStudentRepository.appendRows(id_request, rows);
    await this.courseRequestRepository.update(id_request, { source: CourseRequestSource.EXCEL });
    return { inserted: inserted.length, matchedFields };
  }

  async close(id_request: number) {
    await this.ensureExists(id_request);
    return this.courseRequestRepository.update(id_request, {
      status: CourseRequestStatus.CERRADA,
      closed_at: new Date(),
    });
  }

  async reopen(id_request: number) {
    await this.ensureExists(id_request);
    return this.courseRequestRepository.update(id_request, {
      status: CourseRequestStatus.ABIERTA,
      closed_at: null,
    });
  }

  async remove(id_request: number) {
    await this.ensureExists(id_request);
    await this.courseRequestRepository.delete(id_request);
    return { deleted: true };
  }
}
