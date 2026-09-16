import { Injectable } from "@nestjs/common";
import { ConsultingClientService } from "./consultoria-client.service";
import { ConsultingCuadroService } from "./consultoria-cuadro.service";
import { ConsultingCompetencyRepository } from "src/database/repository/consultoria/consulting-competency.repository";
import { ConsultingJobPositionAliasRepository } from "src/database/repository/consultoria/consulting-job-position-alias.repository";
import { ConsultingPositionCompetencyTemplateRepository } from "src/database/repository/consultoria/consulting-position-competency-template.repository";
import { ConsultingCompetencyEvaluationRepository } from "src/database/repository/consultoria/consulting-competency-evaluation.repository";
import { SetConsultingCompetencyEvaluationDto } from "./dto/set-consulting-competency-evaluation.dto";

@Injectable()
export class ConsultingCompetencyEvaluationService {
  constructor(
    private readonly consultingClientService: ConsultingClientService,
    private readonly consultingCuadroService: ConsultingCuadroService,
    private readonly consultingCompetencyRepository: ConsultingCompetencyRepository,
    private readonly consultingJobPositionAliasRepository: ConsultingJobPositionAliasRepository,
    private readonly consultingPositionCompetencyTemplateRepository: ConsultingPositionCompetencyTemplateRepository,
    private readonly consultingCompetencyEvaluationRepository: ConsultingCompetencyEvaluationRepository,
  ) {}

  /**
   * Roster del centro en esta consultoría, con las 25 competencias de cada
   * trabajador. El valor "efectivo" de una celda es: lo ya evaluado, si lo
   * hay; si no, el valor por defecto de la plantilla de su puesto (resuelto
   * vía alias de `job_position`); si no hay ni una cosa ni otra, en blanco.
   * Solo se persiste una fila real al editar una celda — ver
   * docs/consultoria.md.
   */
  async getRosterWithCompetencies(id_consulting_client: number, id_annual_engagement: number, id_center: number) {
    const [{ year, members }, competencies, evaluations] = await Promise.all([
      this.consultingCuadroService.getRoster(id_consulting_client, id_annual_engagement, id_center),
      this.consultingCompetencyRepository.findAll(),
      this.consultingCompetencyEvaluationRepository.findByCenterEngagement(id_center, id_annual_engagement),
    ]);

    const jobPositionTexts = [...new Set(members.map((m) => m.job_position).filter((v): v is string => !!v))];
    const aliases = await this.consultingJobPositionAliasRepository.findByJobPositionTexts(jobPositionTexts);
    const aliasByText = new Map(aliases.map((a) => [a.job_position, a.id_job_position]));

    const jobPositionIds = [...new Set(aliases.map((a) => a.id_job_position))];
    const templates = await Promise.all(jobPositionIds.map((id) => this.consultingPositionCompetencyTemplateRepository.findByJobPosition(id)));
    const templateByJobPosition = new Map(jobPositionIds.map((id, idx) => [id, templates[idx]]));

    const evaluationByUserCompetency = new Map(evaluations.map((e) => [`${e.id_user}-${e.id_competency}`, e]));

    const membersWithCompetencies = members.map((member) => {
      const id_job_position = member.job_position ? aliasByText.get(member.job_position) ?? null : null;
      const template = id_job_position !== null ? templateByJobPosition.get(id_job_position) : undefined;
      const templateByCompetency = new Map((template ?? []).map((t) => [t.id_competency, t.default_value]));

      const values = competencies.map((c) => {
        const evaluation = evaluationByUserCompetency.get(`${member.id_user}-${c.id_competency}`);
        if (evaluation) return { id_competency: c.id_competency, value: evaluation.value, source: 'evaluated' as const };
        if (templateByCompetency.has(c.id_competency)) return { id_competency: c.id_competency, value: templateByCompetency.get(c.id_competency) ?? null, source: 'template' as const };
        return { id_competency: c.id_competency, value: null, source: 'blank' as const };
      });

      return { ...member, id_job_position, values };
    });

    return { year, competencies, members: membersWithCompetencies };
  }

  async setValue(
    id_consulting_client: number,
    id_annual_engagement: number,
    id_center: number,
    id_user: number,
    id_competency: number,
    dto: SetConsultingCompetencyEvaluationDto,
    evaluated_by?: number,
  ) {
    await this.consultingClientService.getValidatedEngagementCenter(id_consulting_client, id_annual_engagement, id_center);
    return this.consultingCompetencyEvaluationRepository.upsert(id_user, id_center, id_competency, id_annual_engagement, dto.value ?? null, evaluated_by);
  }
}
