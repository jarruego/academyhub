import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConsultingAnnualEngagementRepository } from "src/database/repository/consultoria/consulting-annual-engagement.repository";
import { ConsultingEngagementCenterRepository } from "src/database/repository/consultoria/consulting-engagement-center.repository";
import { ConsultingPlanItemRepository } from "src/database/repository/consultoria/consulting-plan-item.repository";
import { ConsultingEvaluationService } from "./consultoria-evaluation.service";
import { ConsultingCuadroService } from "./consultoria-cuadro.service";
import { ConsultingCompetencyEvaluationService } from "./consultoria-competency-evaluation.service";
import { ConsultingJobPositionService } from "./consultoria-job-position.service";
import { ConsultingJobPositionAliasService } from "./consultoria-job-position-alias.service";
import { ConsultingEngagementStatus } from "src/types/consulting/consulting-engagement-status.enum";
import { CreateConsultingActionEvaluationDto } from "./dto/create-consulting-action-evaluation.dto";
import { UpdateConsultingActionEvaluationDto } from "./dto/update-consulting-action-evaluation.dto";
import { SetConsultingCompetencyEvaluationDto } from "./dto/set-consulting-competency-evaluation.dto";
import { CreateConsultingActionAttendeeDto } from "./dto/create-consulting-action-attendee.dto";
import { UpsertConsultingJobPositionAliasDto } from "./dto/upsert-consulting-job-position-alias.dto";

/**
 * Acceso externo de un centro a su consultoría (token — ver
 * docs/consultoria.md, "Guards y acceso externo"). Alcance cerrado: evaluar
 * sus acciones, evaluar competencias y registrar asistentes de sus propias
 * acciones — nunca navegar a otros centros ni exportar en masa. `id_center`
 * viene siempre del token (`ConsultingTokenGuard`), nunca del cliente.
 *
 * Reutiliza los servicios internos ya existentes (mismas reglas de
 * validación) en vez de duplicarlas — solo añade aquí lo que es propio del
 * acceso externo: resolver la consultoría a partir del centro (sin
 * `id_consulting_client` explícito, que el token no conoce) y bloquear la
 * escritura si la consultoría está cerrada. El buscador de trabajadores del
 * roster interno (`GET /user/lookup`, todo el sistema) **no se expone**
 * aquí a propósito — para elegir a quién registrar como asistente basta el
 * roster de este centro (`getRoster`), ya scoped; no hace falta abrir una
 * búsqueda de todos los usuarios de la app a un token externo.
 */
@Injectable()
export class ConsultingCentroService {
  constructor(
    private readonly consultingAnnualEngagementRepository: ConsultingAnnualEngagementRepository,
    private readonly consultingEngagementCenterRepository: ConsultingEngagementCenterRepository,
    private readonly consultingPlanItemRepository: ConsultingPlanItemRepository,
    private readonly consultingEvaluationService: ConsultingEvaluationService,
    private readonly consultingCuadroService: ConsultingCuadroService,
    private readonly consultingCompetencyEvaluationService: ConsultingCompetencyEvaluationService,
    private readonly consultingJobPositionService: ConsultingJobPositionService,
    private readonly consultingJobPositionAliasService: ConsultingJobPositionAliasService,
  ) {}

  /** Consultorías en las que participa este centro — para que elija el año. */
  async listEngagements(id_center: number) {
    return this.consultingEngagementCenterRepository.findByCenterId(id_center);
  }

  private async getValidatedEngagement(id_center: number, id_annual_engagement: number) {
    const engagement = await this.consultingAnnualEngagementRepository.findById(id_annual_engagement);
    const participates = engagement && await this.consultingEngagementCenterRepository.isParticipant(id_annual_engagement, id_center);
    if (!engagement || !participates) throw new NotFoundException("Consultoría no encontrada para este centro");
    return engagement;
  }

  private assertWritable(engagement: { status: string }) {
    if (engagement.status !== ConsultingEngagementStatus.OPEN) {
      throw new ForbiddenException("Esta consultoría está cerrada — solo lectura");
    }
  }

  /** Plan efectivo de este centro (base + propio) — para elegir qué acción evaluar. */
  async listActions(id_center: number, id_annual_engagement: number) {
    await this.getValidatedEngagement(id_center, id_annual_engagement);
    const items = await this.consultingPlanItemRepository.findEffectiveForCenter(id_annual_engagement, id_center);
    const map = new Map<number, { id_catalog_course: number; name: string; origin?: string | null }>();
    for (const item of items) {
      map.set(item.id_catalog_course, { id_catalog_course: item.id_catalog_course, name: item.name, origin: item.origin });
    }
    return Array.from(map.values());
  }

  async listEvaluations(id_center: number, id_annual_engagement: number) {
    const engagement = await this.getValidatedEngagement(id_center, id_annual_engagement);
    return this.consultingEvaluationService.findByEngagementCenter(engagement.id_consulting_client, id_annual_engagement, id_center);
  }

  async createEvaluation(id_center: number, id_annual_engagement: number, dto: CreateConsultingActionEvaluationDto) {
    const engagement = await this.getValidatedEngagement(id_center, id_annual_engagement);
    this.assertWritable(engagement);
    // evaluated_by queda NULL: lo hace el propio centro, no un miembro de Mecohisa.
    return this.consultingEvaluationService.create(engagement.id_consulting_client, id_annual_engagement, id_center, dto, undefined);
  }

  async updateEvaluation(id_center: number, id_annual_engagement: number, id_action_evaluation: number, dto: UpdateConsultingActionEvaluationDto) {
    const engagement = await this.getValidatedEngagement(id_center, id_annual_engagement);
    this.assertWritable(engagement);
    return this.consultingEvaluationService.update(engagement.id_consulting_client, id_annual_engagement, id_center, id_action_evaluation, dto);
  }

  async removeEvaluation(id_center: number, id_annual_engagement: number, id_action_evaluation: number) {
    const engagement = await this.getValidatedEngagement(id_center, id_annual_engagement);
    this.assertWritable(engagement);
    return this.consultingEvaluationService.remove(engagement.id_consulting_client, id_annual_engagement, id_center, id_action_evaluation);
  }

  /** Roster de este centro en esta consultoría — de solo lectura aquí (sin ajustes, eso sigue siendo cosa de ADMIN/CONSULTOR). */
  async getRoster(id_center: number, id_annual_engagement: number) {
    const engagement = await this.getValidatedEngagement(id_center, id_annual_engagement);
    return this.consultingCuadroService.getRoster(engagement.id_consulting_client, id_annual_engagement, id_center);
  }

  async getCompetencies(id_center: number, id_annual_engagement: number) {
    const engagement = await this.getValidatedEngagement(id_center, id_annual_engagement);
    return this.consultingCompetencyEvaluationService.getRosterWithCompetencies(engagement.id_consulting_client, id_annual_engagement, id_center);
  }

  async setCompetency(id_center: number, id_annual_engagement: number, id_user: number, id_competency: number, dto: SetConsultingCompetencyEvaluationDto) {
    const engagement = await this.getValidatedEngagement(id_center, id_annual_engagement);
    this.assertWritable(engagement);
    // evaluated_by queda NULL: lo hace el propio centro, no un miembro de Mecohisa.
    return this.consultingCompetencyEvaluationService.setValue(engagement.id_consulting_client, id_annual_engagement, id_center, id_user, id_competency, dto, undefined);
  }

  /** Catálogo de puestos de trabajo, para elegir el mapeo desde la propia evaluación de competencias. */
  async getJobPositions(id_center: number, id_annual_engagement: number) {
    await this.getValidatedEngagement(id_center, id_annual_engagement);
    return this.consultingJobPositionService.findAll();
  }

  /**
   * Mapea (o remapea) un valor de `job_position` al catálogo, desde la
   * evaluación de competencias del propio centro. OJO: `consulting_job_
   * position_aliases` es GLOBAL, no por centro (mismo valor de texto puede
   * venir de trabajadores de otros centros) — decisión consciente: un centro
   * con su enlace puede cambiar cómo se resuelve ese valor para TODOS los
   * centros de la consultoría, no solo el suyo (ver
   * consulting_job_position_alias.table.ts). Se valida igual que
   * `setCompetency` (participa en la consultoría, consultoría abierta) para
   * no dejarlo mapear si la consultoría ya está cerrada.
   */
  async upsertJobPositionAlias(id_center: number, id_annual_engagement: number, dto: UpsertConsultingJobPositionAliasDto) {
    const engagement = await this.getValidatedEngagement(id_center, id_annual_engagement);
    this.assertWritable(engagement);
    return this.consultingJobPositionAliasService.upsert(dto);
  }

  /** Cuadro de este centro (cruce trabajador × acción, real + manual) — para ver y registrar asistentes de sus propias acciones. */
  async getCuadro(id_center: number, id_annual_engagement: number) {
    const engagement = await this.getValidatedEngagement(id_center, id_annual_engagement);
    return this.consultingCuadroService.getCuadro(engagement.id_consulting_client, id_annual_engagement, id_center);
  }

  async addAttendee(id_center: number, id_annual_engagement: number, dto: CreateConsultingActionAttendeeDto) {
    const engagement = await this.getValidatedEngagement(id_center, id_annual_engagement);
    this.assertWritable(engagement);
    // created_by queda NULL: lo hace el propio centro, no un miembro de Mecohisa.
    return this.consultingCuadroService.addAttendee(engagement.id_consulting_client, id_annual_engagement, id_center, dto, undefined);
  }

  async removeAttendee(id_center: number, id_annual_engagement: number, id_action_attendee: number) {
    const engagement = await this.getValidatedEngagement(id_center, id_annual_engagement);
    this.assertWritable(engagement);
    return this.consultingCuadroService.removeAttendee(engagement.id_consulting_client, id_annual_engagement, id_center, id_action_attendee);
  }
}
