import { Injectable } from "@nestjs/common";
import { ConsultingCompetencyRepository } from "src/database/repository/consultoria/consulting-competency.repository";
import { ConsultingPositionCompetencyTemplateRepository } from "src/database/repository/consultoria/consulting-position-competency-template.repository";
import { SetConsultingCompetencyTemplateDto } from "./dto/set-consulting-competency-template.dto";

@Injectable()
export class ConsultingCompetencyTemplateService {
  constructor(
    private readonly consultingCompetencyRepository: ConsultingCompetencyRepository,
    private readonly consultingPositionCompetencyTemplateRepository: ConsultingPositionCompetencyTemplateRepository,
  ) {}

  /** Las 25 competencias con el valor por defecto configurado para este puesto (null = todavía sin configurar / no aplica). */
  async findForJobPosition(id_job_position: number) {
    const [competencies, template] = await Promise.all([
      this.consultingCompetencyRepository.findAll(),
      this.consultingPositionCompetencyTemplateRepository.findByJobPosition(id_job_position),
    ]);
    const byCompetency = new Map(template.map((t) => [t.id_competency, t.default_value]));
    return competencies.map((c) => ({
      id_competency: c.id_competency,
      name: c.name,
      default_value: byCompetency.has(c.id_competency) ? byCompetency.get(c.id_competency) : null,
    }));
  }

  async set(id_job_position: number, id_competency: number, dto: SetConsultingCompetencyTemplateDto) {
    return this.consultingPositionCompetencyTemplateRepository.upsert(id_job_position, id_competency, dto.default_value ?? null);
  }
}
