import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { CourseCandidateRepository } from "src/database/repository/course-candidate/course-candidate.repository";
import { CourseRepository } from "src/database/repository/course/course.repository";
import { CourseInterestFilters, CourseInterestRepository } from "src/database/repository/course-interest/course-interest.repository";
import { CandidateProcessStatus, CandidateSource } from "src/types/course-candidate/course-candidate.enums";
import { InterestStatus, SYSTEM_ONLY_INTEREST_STATUSES } from "src/types/course-interest/course-interest.enums";
import { CreateCourseInterestDto } from "./dto/create-course-interest.dto";
import { IncorporateInterestsDto } from "./dto/incorporate-interests.dto";
import { UpdateCourseInterestsDto } from "./dto/update-course-interests.dto";

@Injectable()
export class CourseInterestService {
  constructor(
    private readonly repository: CourseInterestRepository,
    private readonly candidateRepository: CourseCandidateRepository,
    private readonly courseRepository: CourseRepository,
  ) {}

  findByCatalogCourse(idCatalogCourse: number) {
    return this.repository.findByCatalogCourse(idCatalogCourse);
  }

  findAll(filters: CourseInterestFilters) {
    return this.repository.findAll(filters);
  }

  async create(dto: CreateCourseInterestDto, actorId?: number) {
    const open = await this.repository.findOpenByUserAndCatalogCourse(dto.id_user, dto.id_catalog_course);
    if (open) {
      throw new ConflictException("Esta persona ya tiene un interés abierto para este curso de catálogo.");
    }
    return this.repository.create({
      id_user: dto.id_user,
      id_catalog_course: dto.id_catalog_course,
      source: dto.source,
      preferred_modality: dto.preferred_modality,
      availability: dto.availability?.trim() || null,
      notes: dto.notes?.trim() || null,
      assigned_to: dto.assigned_to,
      created_by: actorId,
    });
  }

  async updateMany(dto: UpdateCourseInterestsDto) {
    return this.repository.transaction(async (transaction) => {
      const updated = [];
      for (const { id_interest, ...data } of dto.interests) {
        const existing = await this.repository.findById(id_interest, { transaction });
        if (!existing) throw new NotFoundException(`Interés ${id_interest} no encontrado.`);
        const patch: typeof data & { closed_at?: Date | null } = { ...data };
        if (data.status && data.status !== existing.status) {
          this.assertManualTransition(existing.status, data.status);
          patch.closed_at = data.status === InterestStatus.DISCARDED ? new Date() : null;
        }
        updated.push(await this.repository.update(id_interest, patch, { transaction }));
      }
      return updated;
    });
  }

  /**
   * `CONVOCADO`/`MATRICULADO` son estados derivados (existe una candidatura
   * real detrás) y nunca se asignan desde el editor manual. Tampoco se puede
   * descartar un interés que ya está incorporado a una convocatoria: hay que
   * actuar sobre la candidatura en esa edición (que reabre el interés
   * automáticamente si corresponde).
   */
  private assertManualTransition(from: string, to: InterestStatus) {
    const systemOnly: readonly string[] = SYSTEM_ONLY_INTEREST_STATUSES;
    if (systemOnly.includes(to)) {
      throw new ConflictException(`El estado "${to}" lo asigna el sistema (incorporar a una edición o matricular la candidatura); no se puede establecer manualmente.`);
    }
    if (to === InterestStatus.DISCARDED && systemOnly.includes(from)) {
      throw new ConflictException("Este interés ya está incorporado a una convocatoria: actúa sobre la candidatura en la edición correspondiente.");
    }
  }

  async delete(id: number) {
    const interest = await this.repository.findById(id);
    if (!interest) throw new NotFoundException("Interés no encontrado.");
    if (interest.status === InterestStatus.CALLED || interest.status === InterestStatus.ENROLLED) {
      throw new ConflictException("No se puede eliminar: este interés ya se ha incorporado a una convocatoria.");
    }
    return this.repository.delete(id);
  }

  /**
   * "Incorporar a edición": crea una candidatura en la edición indicada para
   * cada interés seleccionado y marca esos intereses como CONVOCADO. La
   * edición debe pertenecer al mismo curso de catálogo que los intereses.
   */
  async incorporate(dto: IncorporateInterestsDto, actorId?: number) {
    const course = await this.courseRepository.findById(dto.id_course);
    if (!course) throw new NotFoundException("Edición no encontrada.");

    const interests = await this.repository.findManyByIds(dto.interest_ids);
    if (interests.length !== dto.interest_ids.length) {
      throw new NotFoundException("Alguno de los intereses indicados no existe.");
    }
    const mismatched = interests.find((interest) => interest.id_catalog_course !== course.id_catalog_course);
    if (mismatched) {
      throw new ConflictException("Todos los intereses deben pertenecer al mismo curso de catálogo que la edición.");
    }
    const notOpen = interests.find((interest) => interest.status !== InterestStatus.INTERESTED && interest.status !== InterestStatus.CONTACTED);
    if (notOpen) {
      throw new ConflictException("Solo se pueden incorporar intereses en estado Interesado o Contactado.");
    }

    return this.repository.transaction(async (transaction) => {
      const created = [];
      for (const interest of interests) {
        const candidate = await this.candidateRepository.upsert({
          id_user: interest.id_user,
          id_course: dto.id_course,
          source: CandidateSource.COURSE_INTEREST,
          process_status: CandidateProcessStatus.PENDING,
          id_interest: interest.id_interest,
          created_by: actorId,
        }, { transaction });
        if (candidate && !candidate.id_interest) {
          await this.candidateRepository.update(candidate.id_candidate, { id_interest: interest.id_interest }, { transaction });
        }
        await this.repository.update(interest.id_interest, { status: InterestStatus.CALLED }, { transaction });
        created.push(candidate);
      }
      return created;
    });
  }
}
