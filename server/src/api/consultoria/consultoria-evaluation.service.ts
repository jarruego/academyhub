import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConsultingActionEvaluationRepository } from "src/database/repository/consultoria/consulting-action-evaluation.repository";
import { ConsultingPlanItemRepository } from "src/database/repository/consultoria/consulting-plan-item.repository";
import { ConsultingClientService } from "./consultoria-client.service";
import { CreateConsultingActionEvaluationDto } from "./dto/create-consulting-action-evaluation.dto";
import { UpdateConsultingActionEvaluationDto } from "./dto/update-consulting-action-evaluation.dto";

@Injectable()
export class ConsultingEvaluationService {
  constructor(
    private readonly consultingActionEvaluationRepository: ConsultingActionEvaluationRepository,
    private readonly consultingPlanItemRepository: ConsultingPlanItemRepository,
    private readonly consultingClientService: ConsultingClientService,
  ) {}

  private assertPercentageRule(dto: { percentage?: number; evaluation_text?: string }) {
    if (dto.percentage !== undefined && dto.percentage < 50 && !dto.evaluation_text?.trim()) {
      throw new BadRequestException("Una evaluación por debajo del 50% necesita explicar el motivo en el texto de evaluación");
    }
  }

  private assertDateInEngagementYear(evaluation_date: string, year: number) {
    if (new Date(evaluation_date).getFullYear() !== year) {
      throw new BadRequestException(`La fecha debe caer en ${year} — el año de esta consultoría`);
    }
  }

  /** Evaluaciones de acciones: viven dentro de una consultoría + centro concretos. */
  async findByEngagementCenter(id_consulting_client: number, id_annual_engagement: number, id_center: number) {
    await this.consultingClientService.getValidatedEngagementCenter(id_consulting_client, id_annual_engagement, id_center);
    return this.consultingActionEvaluationRepository.findByCenterAndEngagement(id_center, id_annual_engagement);
  }

  async create(id_consulting_client: number, id_annual_engagement: number, id_center: number, dto: CreateConsultingActionEvaluationDto, evaluated_by?: number) {
    const engagement = await this.consultingClientService.getValidatedEngagementCenter(id_consulting_client, id_annual_engagement, id_center);
    this.assertPercentageRule(dto);
    this.assertDateInEngagementYear(dto.evaluation_date, engagement.year);

    const inPlan = await this.consultingPlanItemRepository.existsForCenter(id_consulting_client, id_center, dto.id_catalog_course);
    if (!inPlan) throw new BadRequestException("Esta acción no está en el plan de este centro (ni en el base) — añádela primero en la pestaña Plan");

    return this.consultingActionEvaluationRepository.create({
      id_catalog_course: dto.id_catalog_course,
      id_center,
      id_annual_engagement,
      evaluation_date: new Date(dto.evaluation_date),
      evaluation_text: dto.evaluation_text,
      percentage: dto.percentage,
      imparte_text: dto.imparte_text,
      evaluated_by,
    });
  }

  private async findOwned(id_consulting_client: number, id_annual_engagement: number, id_center: number, id_action_evaluation: number) {
    const engagement = await this.consultingClientService.getValidatedEngagementCenter(id_consulting_client, id_annual_engagement, id_center);
    const evaluation = await this.consultingActionEvaluationRepository.findById(id_action_evaluation);
    if (!evaluation || evaluation.id_annual_engagement !== id_annual_engagement || evaluation.id_center !== id_center) {
      throw new NotFoundException("Evaluación no encontrada en esta consultoría");
    }
    return { engagement, evaluation };
  }

  async update(id_consulting_client: number, id_annual_engagement: number, id_center: number, id_action_evaluation: number, dto: UpdateConsultingActionEvaluationDto) {
    const { engagement, evaluation } = await this.findOwned(id_consulting_client, id_annual_engagement, id_center, id_action_evaluation);
    this.assertPercentageRule({
      percentage: dto.percentage ?? evaluation.percentage ?? undefined,
      evaluation_text: dto.evaluation_text ?? evaluation.evaluation_text ?? undefined,
    });
    if (dto.evaluation_date) this.assertDateInEngagementYear(dto.evaluation_date, engagement.year);

    return this.consultingActionEvaluationRepository.update(id_action_evaluation, {
      ...(dto.evaluation_date ? { evaluation_date: new Date(dto.evaluation_date) } : {}),
      ...(dto.evaluation_text !== undefined ? { evaluation_text: dto.evaluation_text } : {}),
      ...(dto.percentage !== undefined ? { percentage: dto.percentage } : {}),
      ...(dto.imparte_text !== undefined ? { imparte_text: dto.imparte_text } : {}),
    });
  }

  async remove(id_consulting_client: number, id_annual_engagement: number, id_center: number, id_action_evaluation: number) {
    await this.findOwned(id_consulting_client, id_annual_engagement, id_center, id_action_evaluation);
    return this.consultingActionEvaluationRepository.remove(id_action_evaluation);
  }
}
