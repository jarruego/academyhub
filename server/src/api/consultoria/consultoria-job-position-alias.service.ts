import { Injectable } from "@nestjs/common";
import { ConsultingJobPositionAliasRepository } from "src/database/repository/consultoria/consulting-job-position-alias.repository";
import { UpsertConsultingJobPositionAliasDto } from "./dto/upsert-consulting-job-position-alias.dto";

@Injectable()
export class ConsultingJobPositionAliasService {
  constructor(private readonly consultingJobPositionAliasRepository: ConsultingJobPositionAliasRepository) {}

  async findAll() {
    return this.consultingJobPositionAliasRepository.findAll();
  }

  /** Valores de `user.job_position` que todavía no tienen un puesto del catálogo asignado. */
  async findUnmapped() {
    return this.consultingJobPositionAliasRepository.findUnmapped();
  }

  async upsert(dto: UpsertConsultingJobPositionAliasDto) {
    return this.consultingJobPositionAliasRepository.upsert(dto.job_position, dto.id_job_position);
  }

  async remove(id_job_position_alias: number) {
    await this.consultingJobPositionAliasRepository.remove(id_job_position_alias);
    return { success: true };
  }
}
