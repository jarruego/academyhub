import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConsultingRosterAdjustmentRepository } from "src/database/repository/consultoria/consulting-roster-adjustment.repository";
import { ConsultingActionAttendeeRepository } from "src/database/repository/consultoria/consulting-action-attendee.repository";
import { ConsultingCuadroRepository } from "src/database/repository/consultoria/consulting-cuadro.repository";
import { ConsultingPlanItemRepository } from "src/database/repository/consultoria/consulting-plan-item.repository";
import { CourseRepository } from "src/database/repository/course/course.repository";
import { ConsultingClientService } from "./consultoria-client.service";
import { UpsertConsultingRosterAdjustmentDto } from "./dto/upsert-consulting-roster-adjustment.dto";
import { CreateConsultingActionAttendeeDto } from "./dto/create-consulting-action-attendee.dto";
import { ConsultingRosterAdjustmentType } from "src/types/consulting/consulting-roster-adjustment-type.enum";

@Injectable()
export class ConsultingCuadroService {
  constructor(
    private readonly consultingRosterAdjustmentRepository: ConsultingRosterAdjustmentRepository,
    private readonly consultingActionAttendeeRepository: ConsultingActionAttendeeRepository,
    private readonly consultingCuadroRepository: ConsultingCuadroRepository,
    private readonly consultingPlanItemRepository: ConsultingPlanItemRepository,
    private readonly courseRepository: CourseRepository,
    private readonly consultingClientService: ConsultingClientService,
  ) {}

  /** Roster efectivo del año de esta consultoría = trabajadores reales (`user_center`) activos ese año ∪ ajustes ADD − ajustes REMOVE de esta consultoría. */
  async getRoster(id_consulting_client: number, id_annual_engagement: number, id_center: number) {
    const engagement = await this.consultingClientService.getValidatedEngagementCenter(id_consulting_client, id_annual_engagement, id_center);
    const [realMembers, adjustments] = await Promise.all([
      this.consultingRosterAdjustmentRepository.findRealMembers(id_center, engagement.year),
      this.consultingRosterAdjustmentRepository.findAdjustments(id_center, id_annual_engagement),
    ]);
    const removedIds = new Set(adjustments.filter((a) => a.adjustment_type === ConsultingRosterAdjustmentType.REMOVE).map((a) => a.id_user));
    const addedRows = adjustments.filter((a) => a.adjustment_type === ConsultingRosterAdjustmentType.ADD);

    const members = [
      ...realMembers.filter((u) => !removedIds.has(u.id_user)).map((u) => ({ ...u, source: 'real' as const })),
      ...addedRows.map((a) => ({ id_user: a.id_user, name: a.name, first_surname: a.first_surname, second_surname: a.second_surname, dni: a.dni, job_position: a.job_position, source: 'added' as const })),
    ];
    return { year: engagement.year, members, adjustments };
  }

  async setRosterAdjustment(id_consulting_client: number, id_annual_engagement: number, id_center: number, id_user: number, dto: UpsertConsultingRosterAdjustmentDto, created_by?: number) {
    await this.consultingClientService.getValidatedEngagementCenter(id_consulting_client, id_annual_engagement, id_center);
    await this.consultingRosterAdjustmentRepository.upsert(id_center, id_user, id_annual_engagement, dto.adjustment_type, created_by);
    return { success: true };
  }

  async removeRosterAdjustment(id_consulting_client: number, id_annual_engagement: number, id_center: number, id_roster_adjustment: number) {
    await this.consultingClientService.getValidatedEngagementCenter(id_consulting_client, id_annual_engagement, id_center);
    await this.consultingRosterAdjustmentRepository.remove(id_roster_adjustment);
    return { success: true };
  }

  /** Cruce trabajador × acción del año de esta consultoría: real (matrícula, edición) si existe, si no manual. */
  async getCuadro(id_consulting_client: number, id_annual_engagement: number, id_center: number) {
    const engagement = await this.consultingClientService.getValidatedEngagementCenter(id_consulting_client, id_annual_engagement, id_center);
    const planItems = await this.consultingPlanItemRepository.findByClientId(id_consulting_client);
    const actionsMap = new Map<number, string>();
    for (const item of planItems) {
      if (item.id_center === null || item.id_center === id_center) actionsMap.set(item.id_catalog_course, item.name);
    }

    const rows: Array<Record<string, unknown>> = [];
    for (const [id_catalog_course, action_name] of actionsMap) {
      const editions = await this.courseRepository.findAll({ id_catalog_course });
      if (editions.length > 0) {
        const real = await this.consultingCuadroRepository.findRealAttendance(id_center, id_catalog_course, engagement.year);
        rows.push(...real.map((r) => ({ ...r, id_catalog_course, action_name, source: 'real' as const })));
      } else {
        const manual = await this.consultingActionAttendeeRepository.findByCenterAndCatalogCourse(id_center, id_catalog_course, id_annual_engagement);
        rows.push(...manual.map((m) => ({ ...m, source: 'manual' as const })));
      }
    }
    return { year: engagement.year, rows };
  }

  /** ¿Se puede registrar asistentes a mano para esta acción? Solo si no tiene ninguna edición real. */
  async canRegisterAttendees(id_catalog_course: number) {
    const editions = await this.courseRepository.findAll({ id_catalog_course });
    return editions.length === 0;
  }

  async addAttendee(id_consulting_client: number, id_annual_engagement: number, id_center: number, dto: CreateConsultingActionAttendeeDto, created_by?: number) {
    const engagement = await this.consultingClientService.getValidatedEngagementCenter(id_consulting_client, id_annual_engagement, id_center);
    if (new Date(dto.attended_at).getFullYear() !== engagement.year) {
      throw new BadRequestException(`La fecha debe caer en ${engagement.year} — el año de esta consultoría`);
    }

    const inPlan = await this.consultingPlanItemRepository.existsForCenter(id_consulting_client, id_center, dto.id_catalog_course);
    if (!inPlan) throw new BadRequestException("Esta acción no está en el plan de este centro (ni en el base) — añádela primero en la pestaña Plan");

    const canRegister = await this.canRegisterAttendees(dto.id_catalog_course);
    if (!canRegister) throw new BadRequestException("Esta acción tiene matrícula real (edición) — el cuadro se deriva automáticamente de ella, no se registra a mano");

    return this.consultingActionAttendeeRepository.add({
      id_catalog_course: dto.id_catalog_course,
      id_center,
      id_annual_engagement,
      id_user: dto.id_user,
      attended_at: new Date(dto.attended_at),
      created_by,
    });
  }

  async removeAttendee(id_consulting_client: number, id_annual_engagement: number, id_center: number, id_action_attendee: number) {
    await this.consultingClientService.getValidatedEngagementCenter(id_consulting_client, id_annual_engagement, id_center);
    const attendee = await this.consultingActionAttendeeRepository.findById(id_action_attendee);
    if (!attendee || attendee.id_center !== id_center || attendee.id_annual_engagement !== id_annual_engagement) {
      throw new NotFoundException("Asistente no encontrado en esta consultoría");
    }
    await this.consultingActionAttendeeRepository.remove(id_action_attendee);
    return { success: true };
  }
}
