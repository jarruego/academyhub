import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { CourseCandidateRepository } from "src/database/repository/course-candidate/course-candidate.repository";
import { CourseInterestRepository } from "src/database/repository/course-interest/course-interest.repository";
import { CourseRepository } from "src/database/repository/course/course.repository";
import { UserPreinscriptionRepository } from "src/database/repository/preinscription/user-preinscription.repository";
import { UserRepository } from "src/database/repository/user/user.repository";
import { QueryOptions } from "src/database/repository/repository";
import { CourseCandidateSelectModel } from "src/database/schema/tables/course_candidate.table";
import { CandidateProcessStatus, CandidateSource } from "src/types/course-candidate/course-candidate.enums";
import { InterestSource, InterestStatus } from "src/types/course-interest/course-interest.enums";
import { CreateCourseCandidateDto } from "./dto/create-course-candidate.dto";
import { UpdateCourseCandidatesDto } from "./dto/update-course-candidates.dto";


@Injectable()
export class CourseCandidateService {
  constructor(
    private readonly repository: CourseCandidateRepository,
    private readonly preinscriptionRepository: UserPreinscriptionRepository,
    private readonly interestRepository: CourseInterestRepository,
    private readonly courseRepository: CourseRepository,
    private readonly userRepository: UserRepository,
  ) {}

  findByCourse(idCourse: number) {
    return this.repository.findByCourse(idCourse);
  }

  async create(dto: CreateCourseCandidateDto, actorId?: number) {
    let id_user = dto.id_user;
    if (!id_user) {
      const name = dto.new_user?.name?.trim();
      const phone = dto.new_user?.phone?.trim();
      const email = dto.new_user?.email?.trim();
      if (!name) throw new BadRequestException("El nombre es obligatorio.");
      if (!phone && !email) throw new BadRequestException("Indica un teléfono o un email de contacto.");
      const created = await this.userRepository.create({
        name,
        first_surname: dto.new_user?.first_surname?.trim() || null,
        second_surname: dto.new_user?.second_surname?.trim() || null,
        dni: dto.new_user?.dni?.trim() || null,
        phone: phone || null,
        email: email || null,
      });
      if (!created.insertId) throw new BadRequestException("No se pudo crear el candidato.");
      id_user = created.insertId;
    }
    const candidate = await this.repository.upsert({
      id_user,
      id_course: dto.id_course,
      source: dto.source ?? CandidateSource.MANUAL,
      created_by: actorId,
    });
    return this.repository.findByCourse(dto.id_course).then(rows => rows.find(row => row.id_candidate === candidate.id_candidate));
  }

  /**
   * `force=true` permite borrar la candidatura aunque la persona conste
   * preinscrita en INAEM (p. ej. una fila duplicada o dada de alta por
   * error) — y en ese caso borra también la preinscripción oficial
   * (`user_preinscription`), en la misma transacción: no tendría sentido
   * dejar una constancia INAEM huérfana sin candidatura detrás.
   */
  async delete(idCandidate: number, force = false) {
    const candidate = await this.repository.findById(idCandidate);
    if (!candidate) throw new NotFoundException("Candidatura no encontrada.");
    const official = await this.preinscriptionRepository.findByUserCourse(candidate.id_user, candidate.id_course);
    if (official && !force) {
      throw new ConflictException("No se puede eliminar: esta persona consta como preinscrita en INAEM.");
    }
    return this.repository.transaction(async (transaction) => {
      // Si la candidatura procedía de un interés (o ya se había vinculado uno
      // al reabrirla antes), borrarla no debe dejarlo encallado en CONVOCADO
      // sin ninguna candidatura real detrás.
      if (candidate.id_interest) {
        const note = `Reabierto automáticamente — candidatura eliminada (${new Date().toLocaleDateString("es-ES")})`;
        await this.reopenInterest(candidate.id_interest, note, { transaction });
      }
      if (official && force) {
        await this.preinscriptionRepository.deleteByUserCourse(candidate.id_user, candidate.id_course, { transaction });
      }
      return this.repository.delete(idCandidate, { transaction });
    });
  }

  async updateMany(dto: UpdateCourseCandidatesDto) {
    return this.repository.transaction(async (transaction) => {
      const updated = [];
      for (const { id_candidate, ...data } of dto.candidates) {
        const existing = await this.repository.findById(id_candidate, { transaction });
        if (!existing) throw new NotFoundException(`Candidatura ${id_candidate} no encontrada.`);
        const row = await this.repository.update(id_candidate, data, { transaction });
        if (data.process_status && data.process_status !== existing.process_status) {
          await this.syncInterestOnStatusChange(existing, data.process_status, { transaction });
        }
        updated.push(row);
      }
      return updated;
    });
  }

  /**
   * Mantiene sincronizado el interés de origen (fase 3) cuando la candidatura
   * pasa a DESCARTADA: reabre el interés (o crea uno nuevo si la candidatura
   * no venía de ninguno) para que la persona siga disponible de cara a la
   * próxima convocatoria del mismo curso de catálogo. RESERVA y BAJA no
   * reabren nada a propósito (RESERVA sigue en proceso; BAJA suele ser
   * decisión propia de la persona). El cierre a MATRICULADO ya no depende de
   * `process_status` (redundante con la
   * situación INAEM): lo hace directamente la importación INAEM
   * (`InaemImportService.linkOpenInterest`).
   */
  private async syncInterestOnStatusChange(candidate: CourseCandidateSelectModel, newStatus: CandidateProcessStatus, options: QueryOptions) {
    if (newStatus !== CandidateProcessStatus.NOT_SELECTED) return;

    const course = await this.courseRepository.findById(candidate.id_course, options);
    if (!course) return;
    const reference = course.file_number ? `Expediente ${course.file_number}` : course.course_name;
    const note = `Reabierto automáticamente — Descartada en ${reference} (${new Date().toLocaleDateString("es-ES")})`;

    if (candidate.id_interest) {
      await this.reopenInterest(candidate.id_interest, note, options);
    } else {
      const created = await this.interestRepository.create({
        id_catalog_course: course.id_catalog_course,
        id_user: candidate.id_user,
        status: InterestStatus.CONTACTED,
        source: InterestSource.OTHER,
        notes: note,
        assigned_to: candidate.assigned_to,
        created_by: candidate.created_by,
      }, options);
      await this.repository.update(candidate.id_candidate, { id_interest: created.id_interest }, options);
    }
  }

  /** Reabre un interés existente a CONTACTADO, anotando el motivo. Usado al descartar/cerrar una candidatura y al borrarla. */
  private async reopenInterest(idInterest: number, note: string, options: QueryOptions) {
    const interest = await this.interestRepository.findById(idInterest, options);
    if (!interest) return;
    await this.interestRepository.update(interest.id_interest, {
      status: InterestStatus.CONTACTED,
      notes: interest.notes ? `${interest.notes}\n${note}` : note,
      closed_at: null,
    }, options);
  }
}
