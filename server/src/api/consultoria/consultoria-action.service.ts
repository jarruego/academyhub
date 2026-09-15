import { Injectable, NotFoundException } from "@nestjs/common";
import { ConsultingActionDetailRepository } from "src/database/repository/consultoria/consulting-action-detail.repository";
import { UpsertConsultingActionDetailDto } from "./dto/upsert-consulting-action-detail.dto";

@Injectable()
export class ConsultingActionService {
  constructor(private readonly consultingActionDetailRepository: ConsultingActionDetailRepository) {}

  async findAll() {
    return this.consultingActionDetailRepository.findAll();
  }

  async findByCatalogCourseId(id_catalog_course: number) {
    const action = await this.consultingActionDetailRepository.findByCatalogCourseId(id_catalog_course);
    if (!action) throw new NotFoundException("Este curso de catálogo todavía no está etiquetado como acción formativa de Consultoría");
    return action;
  }

  /** Alta o edición — id_catalog_course es la clave primaria de la tabla satélite. */
  async upsert(id_catalog_course: number, dto: UpsertConsultingActionDetailDto, created_by?: number) {
    return this.consultingActionDetailRepository.upsert(id_catalog_course, { ...dto, created_by });
  }
}
