import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConsultingPlanItemRepository } from "src/database/repository/consultoria/consulting-plan-item.repository";
import { ConsultingActionDetailRepository } from "src/database/repository/consultoria/consulting-action-detail.repository";
import { ConsultingActionEvaluationRepository } from "src/database/repository/consultoria/consulting-action-evaluation.repository";
import { ConsultingEngagementCenterRepository } from "src/database/repository/consultoria/consulting-engagement-center.repository";
import { ConsultingClientService } from "./consultoria-client.service";
import { CreateConsultingPlanItemDto } from "./dto/create-consulting-plan-item.dto";
import { AddConsultingPlanItemToAllCentersDto } from "./dto/add-consulting-plan-item-to-all-centers.dto";

/**
 * Plan de formación: propio de cada consultoría anual (ver
 * docs/consultoria.md — corregido 2026-09-16, antes era continuo/sin año).
 * "Todos los centros" ya no significa "todos los del cliente", significa
 * "los que participan en esta consultoría" (`consulting_engagement_centers`).
 */
@Injectable()
export class ConsultingPlanService {
  constructor(
    private readonly consultingPlanItemRepository: ConsultingPlanItemRepository,
    private readonly consultingActionDetailRepository: ConsultingActionDetailRepository,
    private readonly consultingActionEvaluationRepository: ConsultingActionEvaluationRepository,
    private readonly consultingEngagementCenterRepository: ConsultingEngagementCenterRepository,
    private readonly consultingClientService: ConsultingClientService,
  ) {}

  async findByEngagement(id_consulting_client: number, id_annual_engagement: number) {
    await this.consultingClientService.getValidatedEngagement(id_consulting_client, id_annual_engagement);
    return this.consultingPlanItemRepository.findByEngagementId(id_annual_engagement);
  }

  async addPlanItem(id_consulting_client: number, id_annual_engagement: number, dto: CreateConsultingPlanItemDto, added_by?: number) {
    const id_center = dto.id_center ?? null;
    if (id_center !== null) {
      await this.consultingClientService.getValidatedEngagementCenter(id_consulting_client, id_annual_engagement, id_center);
    } else {
      await this.consultingClientService.getValidatedEngagement(id_consulting_client, id_annual_engagement);
    }

    const action = await this.consultingActionDetailRepository.findByCatalogCourseId(dto.id_catalog_course);
    if (!action) throw new BadRequestException("Este curso todavía no está etiquetado como acción formativa — etiquétalo antes en Acciones formativas");

    const existing = await this.consultingPlanItemRepository.findLink(id_annual_engagement, id_center, dto.id_catalog_course);
    if (existing) throw new ConflictException("Esta acción ya está en el plan (base o de este centro)");

    return this.consultingPlanItemRepository.addItem({ id_consulting_client, id_annual_engagement, id_center, id_catalog_course: dto.id_catalog_course, added_by });
  }

  /**
   * Alternativa a añadir al plan base (compartido, `id_center` NULL): añade
   * una copia propia a cada centro que participa en esta consultoría, por
   * separado. Centros que ya tuvieran su propia copia se saltan (sin error).
   */
  async addPlanItemToAllCenters(id_consulting_client: number, id_annual_engagement: number, dto: AddConsultingPlanItemToAllCentersDto, added_by?: number) {
    await this.consultingClientService.getValidatedEngagement(id_consulting_client, id_annual_engagement);
    const action = await this.consultingActionDetailRepository.findByCatalogCourseId(dto.id_catalog_course);
    if (!action) throw new BadRequestException("Este curso todavía no está etiquetado como acción formativa — etiquétalo antes en Acciones formativas");

    const centers = await this.consultingEngagementCenterRepository.findByEngagementId(id_annual_engagement);
    const created = [];
    for (const center of centers) {
      const existing = await this.consultingPlanItemRepository.findLink(id_annual_engagement, center.id_center, dto.id_catalog_course);
      if (existing) continue;
      created.push(await this.consultingPlanItemRepository.addItem({ id_consulting_client, id_annual_engagement, id_center: center.id_center, id_catalog_course: dto.id_catalog_course, added_by }));
    }
    return created;
  }

  /**
   * Si la acción es del plan base, afecta a todos los centros que
   * participan en esta consultoría — el aviso de alcance lo da el frontend
   * antes de llamar aquí. Se bloquea siempre, base o propia: no se puede
   * quitar una acción que algún centro afectado ya evaluó — perdería su
   * histórico, salvo que `keepForCenters` esté activo: en ese caso, en vez
   * de bloquear, se reparte una copia propia a cada centro que todavía no
   * la tenga y solo se borra la fila del plan base — nadie pierde nada.
   */
  async removePlanItem(id_consulting_client: number, id_annual_engagement: number, id_plan_item: number, keepForCenters = false, added_by?: number) {
    const engagement = await this.consultingClientService.getValidatedEngagement(id_consulting_client, id_annual_engagement);
    const item = await this.consultingPlanItemRepository.findById(id_plan_item);
    if (!item || item.id_annual_engagement !== engagement.id_annual_engagement) throw new NotFoundException("Acción del plan no encontrada en esta consultoría");

    if (item.id_center === null && keepForCenters) {
      const centers = await this.consultingEngagementCenterRepository.findByEngagementId(id_annual_engagement);
      for (const center of centers) {
        const existing = await this.consultingPlanItemRepository.findLink(id_annual_engagement, center.id_center, item.id_catalog_course);
        if (existing) continue;
        await this.consultingPlanItemRepository.addItem({ id_consulting_client, id_annual_engagement, id_center: center.id_center, id_catalog_course: item.id_catalog_course, added_by });
      }
      return this.consultingPlanItemRepository.removeItem(id_plan_item);
    }

    let centersToCheck: number[];
    if (item.id_center !== null) {
      centersToCheck = [item.id_center];
    } else {
      const centers = await this.consultingEngagementCenterRepository.findByEngagementId(id_annual_engagement);
      centersToCheck = centers.map((c) => c.id_center);
    }

    const evaluations = await this.consultingActionEvaluationRepository.findByCatalogCourseAndCenters(item.id_catalog_course, centersToCheck);
    if (evaluations.length > 0) {
      const where = [...new Set(evaluations.map((e) => `${e.center_name} (${e.year})`))].join(', ');
      throw new ConflictException(`No se puede quitar "${item.name}" del plan: ya la ha evaluado ${where} — se perdería el histórico de evaluación.`);
    }

    return this.consultingPlanItemRepository.removeItem(id_plan_item);
  }
}
