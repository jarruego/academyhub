import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CourseRequestFilters,
  CourseRequestReportFilters,
  CourseRequestRepository,
  CourseRequestStudentRepository,
} from "src/database/repository/course-request/course-request.repository";
import { UserGroupRepository } from "src/database/repository/group/user-group.repository";
import { CreateCourseRequestDto } from "./dto/create-course-request.dto";
import { UpdateCourseRequestDto } from "./dto/update-course-request.dto";
import { CourseRequestStudentDto } from "./dto/course-request-student.dto";
import { parseCourseRequestExcel } from "./course-request-excel.parser";
import { normalizeDni } from "./course-request-normalize.util";
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
    private readonly userGroupRepository: UserGroupRepository,
  ) {}

  async create(dto: CreateCourseRequestDto, createdBy?: number) {
    try {
      return await this.courseRequestRepository.create({
        id_center: dto.id_center ?? null,
        id_course: dto.id_course,
        // Si no se indica, la columna usa su default (fecha de alta).
        ...(dto.request_date ? { request_date: new Date(dto.request_date) } : {}),
        contact_email: dto.contact_email ?? null,
        is_urgent: dto.is_urgent ?? false,
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
    const headers = await this.courseRequestRepository.findAll(filters);
    if (!headers.length) return headers.map((h) => ({ ...h, in_group_student_count: 0 }));
    const assigned = await this.courseRequestStudentRepository.findAssignedByRequests(headers.map((h) => h.id_request));
    const membership = await this.getActiveGroupMembership(assigned.map((a) => a.id_group));
    const inGroupCountByRequest = new Map<number, number>();
    for (const a of assigned) {
      if (a.id_group != null && membership.has(`${a.id_group}:${normalizeDni(a.dni)}`)) {
        inGroupCountByRequest.set(a.id_request, (inGroupCountByRequest.get(a.id_request) ?? 0) + 1);
      }
    }
    return headers.map((h) => ({ ...h, in_group_student_count: inGroupCountByRequest.get(h.id_request) ?? 0 }));
  }

  /** Filas del informe empresa/centro/curso, filtrable por cualquier combinación de empresa/centro/curso/status (empresa admite varias). */
  async report(filters: CourseRequestReportFilters) {
    return this.courseRequestRepository.reportRows(filters);
  }

  async findById(id_request: number) {
    const header = await this.courseRequestRepository.findById(id_request);
    if (!header) throw new NotFoundException("Petición no encontrada.");
    const students = await this.courseRequestStudentRepository.findByRequest(id_request);
    const membership = await this.getActiveGroupMembership(students.map((s) => s.id_group));
    const studentsWithStatus = students.map((s) => ({
      ...s,
      currently_in_group: s.id_group != null && membership.has(`${s.id_group}:${normalizeDni(s.dni)}`),
    }));
    return {
      ...header,
      in_group_student_count: studentsWithStatus.filter((s) => s.currently_in_group).length,
      students: studentsWithStatus,
    };
  }

  /**
   * No se guarda ningún flag de "dado de baja": se calcula al vuelo cruzando
   * (por DNI normalizado, igual que el resto del módulo) los alumnos ya
   * asignados a un grupo contra quién sigue realmente en `user_group` en ese
   * momento. Así no hay que enganchar código en cada sitio donde se puede
   * quitar a alguien de un grupo (baja manual, sync de Moodle...).
   */
  private async getActiveGroupMembership(groupIds: Array<number | null>): Promise<Set<string>> {
    const uniqueGroupIds = [...new Set(groupIds.filter((id): id is number => id != null))];
    if (!uniqueGroupIds.length) return new Set();
    const active = await this.userGroupRepository.findActiveDnisByGroups(uniqueGroupIds);
    return new Set(active.map((r) => `${r.id_group}:${normalizeDni(r.dni)}`));
  }

  /**
   * Libera la asignación de un alumno concreto (vuelve a estar seleccionable
   * en el modal de importación) una vez que ya no está realmente en el grupo
   * al que se matriculó. A propósito NO exige `ensureOpen`: es habitual que la
   * petición ya esté CERRADA (se cerró sola al asignarse el último alumno) y
   * no tiene sentido obligar a reabrirla solo para liberar a uno de sus
   * alumnos; el estado de la petición no cambia por esta acción.
   */
  async releaseStudentGroup(id_request: number, studentId: number) {
    await this.ensureExists(id_request);
    const students = await this.courseRequestStudentRepository.findByRequest(id_request);
    const student = students.find((s) => s.id === studentId);
    if (!student) throw new NotFoundException("Alumno no encontrado en esta petición.");
    if (student.id_group == null) {
      throw new ConflictException("Este alumno no está asignado a ningún grupo.");
    }
    const membership = await this.getActiveGroupMembership([student.id_group]);
    if (membership.has(`${student.id_group}:${normalizeDni(student.dni)}`)) {
      throw new ConflictException("El alumno sigue en el grupo; dalo de baja del grupo antes de liberarlo aquí.");
    }
    await this.courseRequestStudentRepository.releaseGroup(id_request, studentId);
    return this.findById(id_request);
  }

  /**
   * Duplica una petición (cabecera + alumnos) como una nueva petición ABIERTA,
   * para reaprovechar una ya existente. Copia centro/curso/correo/notas, pero
   * NO la fecha de la petición (se pone hoy, es una petición nueva) ni "urgente"
   * (se reinicia a false) ni el estado (siempre nace ABIERTA aunque la original
   * esté cerrada) — todo eso lo controlan los defaults de la propia tabla.
   */
  async duplicate(id_request: number, createdBy?: number) {
    const original = await this.findById(id_request);
    const created = await this.courseRequestRepository.create({
      id_center: original.id_center,
      id_course: original.id_course,
      contact_email: original.contact_email,
      notes: original.notes,
      created_by: createdBy ?? null,
    });
    if (original.students.length) {
      await this.courseRequestStudentRepository.appendRows(
        created.id_request,
        original.students.map(({ name, first_surname, second_surname, dni, email, phone_mobile }) => ({
          name,
          first_surname,
          second_surname,
          dni,
          email,
          phone_mobile,
        })),
      );
    }
    return this.findById(created.id_request);
  }

  /**
   * Asigna alumnos concretos de la petición a un grupo (matriculación desde
   * Peticiones). Solo actualiza a los que aún no tenían grupo, así que un
   * mismo request puede repartirse entre varios grupos en llamadas
   * sucesivas. La petición se cierra sola cuando ya no le queda ningún
   * alumno por asignar.
   */
  async assignStudentsToGroup(id_request: number, id_group: number, studentIds: number[]) {
    const header = await this.ensureExists(id_request);
    this.ensureOpen(header);
    await this.courseRequestStudentRepository.assignGroup(id_request, studentIds, id_group);
    const students = await this.courseRequestStudentRepository.findByRequest(id_request);
    const allAssigned = students.length > 0 && students.every((s) => s.id_group != null);
    if (allAssigned) {
      await this.courseRequestRepository.update(id_request, {
        status: CourseRequestStatus.CERRADA,
        closed_at: new Date(),
      });
    }
    return this.findById(id_request);
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
