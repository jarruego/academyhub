import { ConflictException, Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import {
  ConsultingClientRepository,
  ConsultingClientCompanyRepository,
} from "src/database/repository/consultoria/consulting-client.repository";
import { ConsultingPlanItemRepository } from "src/database/repository/consultoria/consulting-plan-item.repository";
import { ConsultingActionDetailRepository } from "src/database/repository/consultoria/consulting-action-detail.repository";
import { ConsultingActionEvaluationRepository } from "src/database/repository/consultoria/consulting-action-evaluation.repository";
import { ConsultingAnnualEngagementRepository } from "src/database/repository/consultoria/consulting-annual-engagement.repository";
import { ConsultingEngagementCenterRepository } from "src/database/repository/consultoria/consulting-engagement-center.repository";
import { CenterRepository } from "src/database/repository/center/center.repository";
import { ConsultingEngagementStatus } from "src/types/consulting/consulting-engagement-status.enum";
import { CreateConsultingClientDto } from "./dto/create-consulting-client.dto";
import { UpdateConsultingClientDto } from "./dto/update-consulting-client.dto";
import { AddConsultingClientCompanyDto } from "./dto/add-consulting-client-company.dto";
import { CreateConsultingPlanItemDto } from "./dto/create-consulting-plan-item.dto";
import { AddConsultingPlanItemToAllCentersDto } from "./dto/add-consulting-plan-item-to-all-centers.dto";
import { OpenConsultingAnnualEngagementDto } from "./dto/open-consulting-annual-engagement.dto";
import { UpdateConsultingAnnualEngagementDto } from "./dto/update-consulting-annual-engagement.dto";
import { AddConsultingEngagementCenterDto } from "./dto/add-consulting-engagement-center.dto";

@Injectable()
export class ConsultingClientService {
  constructor(
    private readonly consultingClientRepository: ConsultingClientRepository,
    private readonly consultingClientCompanyRepository: ConsultingClientCompanyRepository,
    private readonly consultingPlanItemRepository: ConsultingPlanItemRepository,
    private readonly consultingActionDetailRepository: ConsultingActionDetailRepository,
    private readonly consultingActionEvaluationRepository: ConsultingActionEvaluationRepository,
    private readonly consultingAnnualEngagementRepository: ConsultingAnnualEngagementRepository,
    private readonly consultingEngagementCenterRepository: ConsultingEngagementCenterRepository,
    private readonly centerRepository: CenterRepository,
  ) {}

  /** Todos los centros del cliente, vía sus empresas vinculadas. */
  private async getClientCenters(id_consulting_client: number) {
    const companies = await this.consultingClientCompanyRepository.findByClientId(id_consulting_client);
    const centersByCompany = await Promise.all(companies.map((c) => this.centerRepository.findByCompanyId(c.id_company)));
    const map = new Map<number, Awaited<ReturnType<typeof this.centerRepository.findById>>>();
    for (const centers of centersByCompany) for (const center of centers) map.set(center.id_center, center);
    return Array.from(map.values());
  }

  async create(dto: CreateConsultingClientDto) {
    return this.consultingClientRepository.create(dto);
  }

  async findAll() {
    return this.consultingClientRepository.findAll();
  }

  async findById(id_consulting_client: number) {
    const client = await this.consultingClientRepository.findById(id_consulting_client);
    if (!client) throw new NotFoundException("Cliente de consultoría no encontrado");
    return client;
  }

  async update(id_consulting_client: number, dto: UpdateConsultingClientDto) {
    await this.findById(id_consulting_client);
    return this.consultingClientRepository.update(id_consulting_client, dto);
  }

  async findCompanies(id_consulting_client: number) {
    await this.findById(id_consulting_client);
    return this.consultingClientCompanyRepository.findByClientId(id_consulting_client);
  }

  async addCompany(id_consulting_client: number, dto: AddConsultingClientCompanyDto) {
    await this.findById(id_consulting_client);
    const existing = await this.consultingClientCompanyRepository.findLink(id_consulting_client, dto.id_company);
    if (existing) throw new ConflictException("Esta empresa ya está vinculada a este cliente");
    return this.consultingClientCompanyRepository.addCompany(id_consulting_client, dto.id_company);
  }

  async removeCompany(id_consulting_client: number, id_company: number) {
    await this.findById(id_consulting_client);
    return this.consultingClientCompanyRepository.removeCompany(id_consulting_client, id_company);
  }

  async findPlanItems(id_consulting_client: number) {
    await this.findById(id_consulting_client);
    return this.consultingPlanItemRepository.findByClientId(id_consulting_client);
  }

  async addPlanItem(id_consulting_client: number, dto: CreateConsultingPlanItemDto, added_by?: number) {
    await this.findById(id_consulting_client);
    const id_center = dto.id_center ?? null;

    if (id_center !== null) {
      const center = await this.centerRepository.findById(id_center);
      if (!center) throw new NotFoundException("Centro no encontrado");
      const link = await this.consultingClientCompanyRepository.findLink(id_consulting_client, center.id_company);
      if (!link) throw new BadRequestException("Este centro no pertenece a ninguna empresa vinculada a este cliente");
    }

    const action = await this.consultingActionDetailRepository.findByCatalogCourseId(dto.id_catalog_course);
    if (!action) throw new BadRequestException("Este curso todavía no está etiquetado como acción formativa — etiquétalo antes en Acciones formativas");

    const existing = await this.consultingPlanItemRepository.findLink(id_consulting_client, id_center, dto.id_catalog_course);
    if (existing) throw new ConflictException("Esta acción ya está en el plan (base o de este centro)");

    return this.consultingPlanItemRepository.addItem({ id_consulting_client, id_center, id_catalog_course: dto.id_catalog_course, added_by });
  }

  /**
   * Alternativa a añadir al plan base (compartido, `id_center` NULL):
   * añade una copia propia a cada centro del cliente por separado — deja de
   * ser una plantilla compartida, cada centro tiene su propio ítem desde el
   * principio. Centros que ya tuvieran su propia copia se saltan (sin
   * error). Ver docs/consultoria.md.
   */
  async addPlanItemToAllCenters(id_consulting_client: number, dto: AddConsultingPlanItemToAllCentersDto, added_by?: number) {
    await this.findById(id_consulting_client);
    const action = await this.consultingActionDetailRepository.findByCatalogCourseId(dto.id_catalog_course);
    if (!action) throw new BadRequestException("Este curso todavía no está etiquetado como acción formativa — etiquétalo antes en Acciones formativas");

    const centers = await this.getClientCenters(id_consulting_client);
    const created = [];
    for (const center of centers) {
      const existing = await this.consultingPlanItemRepository.findLink(id_consulting_client, center.id_center, dto.id_catalog_course);
      if (existing) continue;
      created.push(await this.consultingPlanItemRepository.addItem({ id_consulting_client, id_center: center.id_center, id_catalog_course: dto.id_catalog_course, added_by }));
    }
    return created;
  }

  /**
   * Si la acción es del plan base, afecta a todos los centros del cliente —
   * el aviso de alcance ("esto lo quita de TODOS los centros") lo da el
   * frontend antes de llamar aquí. Lo que si se bloquea siempre, base o
   * propia: no se puede quitar una acción que algún centro afectado ya
   * evaluó — perdería su histórico, salvo que `keepForCenters` esté
   * activo: en ese caso, en vez de bloquear, se reparte una copia propia a
   * cada centro que todavía no la tenga (sin tocar los que ya evaluaron) y
   * solo se borra la fila del plan base — nadie pierde nada, así que no
   * hace falta comprobar evaluaciones. Ver docs/consultoria.md.
   */
  async removePlanItem(id_consulting_client: number, id_plan_item: number, keepForCenters = false, added_by?: number) {
    await this.findById(id_consulting_client);
    const item = await this.consultingPlanItemRepository.findById(id_plan_item);
    if (!item || item.id_consulting_client !== id_consulting_client) throw new NotFoundException("Acción del plan no encontrada");

    if (item.id_center === null && keepForCenters) {
      const centers = await this.getClientCenters(id_consulting_client);
      for (const center of centers) {
        const existing = await this.consultingPlanItemRepository.findLink(id_consulting_client, center.id_center, item.id_catalog_course);
        if (existing) continue;
        await this.consultingPlanItemRepository.addItem({ id_consulting_client, id_center: center.id_center, id_catalog_course: item.id_catalog_course, added_by });
      }
      return this.consultingPlanItemRepository.removeItem(id_plan_item);
    }

    const centersToCheck = item.id_center !== null
      ? [item.id_center]
      : (await this.getClientCenters(id_consulting_client)).map((c) => c.id_center);

    const evaluations = await this.consultingActionEvaluationRepository.findByCatalogCourseAndCenters(item.id_catalog_course, centersToCheck);
    if (evaluations.length > 0) {
      const where = [...new Set(evaluations.map((e) => `${e.center_name} (${e.year})`))].join(', ');
      throw new ConflictException(`No se puede quitar "${item.name}" del plan: ya la ha evaluado ${where} — se perdería el histórico de evaluación.`);
    }

    return this.consultingPlanItemRepository.removeItem(id_plan_item);
  }

  // Público — reutilizado por ConsultingEvaluationService/ConsultingCuadroService.
  async assertCenterBelongsToClient(id_consulting_client: number, id_center: number) {
    const centers = await this.getClientCenters(id_consulting_client);
    if (!centers.some((c) => c.id_center === id_center)) {
      throw new BadRequestException("Este centro no pertenece a ninguna empresa vinculada a este cliente");
    }
  }

  async findAnnualEngagements(id_consulting_client: number) {
    await this.findById(id_consulting_client);
    return this.consultingAnnualEngagementRepository.findByClientId(id_consulting_client);
  }

  /** Abrir la consultoría de un año — por defecto incluye todos los centros del cliente. */
  async openAnnualEngagement(id_consulting_client: number, dto: OpenConsultingAnnualEngagementDto, created_by?: number) {
    await this.findById(id_consulting_client);
    const existing = await this.consultingAnnualEngagementRepository.findByClientAndYear(id_consulting_client, dto.year);
    if (existing) throw new ConflictException(`Ya existe una consultoría de ${dto.year} para este cliente`);

    const engagement = await this.consultingAnnualEngagementRepository.open({ id_consulting_client, year: dto.year, created_by });

    let id_centers = dto.id_centers;
    if (id_centers && id_centers.length > 0) {
      for (const id_center of id_centers) await this.assertCenterBelongsToClient(id_consulting_client, id_center);
    } else {
      const clientCenters = await this.getClientCenters(id_consulting_client);
      id_centers = clientCenters.map((c) => c.id_center);
    }
    await this.consultingEngagementCenterRepository.addCenters(engagement.id_annual_engagement, id_centers);

    return engagement;
  }

  async updateAnnualEngagement(id_consulting_client: number, id_annual_engagement: number, dto: UpdateConsultingAnnualEngagementDto) {
    await this.getValidatedEngagement(id_consulting_client, id_annual_engagement);
    return this.consultingAnnualEngagementRepository.setStatus(id_annual_engagement, dto.status as ConsultingEngagementStatus);
  }

  /** Consultoría concreta, validando que pertenece a este cliente. Público — reutilizado por otros servicios. */
  async getValidatedEngagement(id_consulting_client: number, id_annual_engagement: number) {
    await this.findById(id_consulting_client);
    const engagement = await this.consultingAnnualEngagementRepository.findById(id_annual_engagement);
    if (!engagement || engagement.id_consulting_client !== id_consulting_client) throw new NotFoundException("Consultoría anual no encontrada para este cliente");
    return engagement;
  }

  /**
   * Consultoría + centro validados: la consultoría es de este cliente y el
   * centro participa en ella (no basta con pertenecer al cliente). Público —
   * reutilizado por ConsultingEvaluationService y ConsultingCuadroService.
   */
  async getValidatedEngagementCenter(id_consulting_client: number, id_annual_engagement: number, id_center: number) {
    const engagement = await this.getValidatedEngagement(id_consulting_client, id_annual_engagement);
    const participates = await this.consultingEngagementCenterRepository.isParticipant(id_annual_engagement, id_center);
    if (!participates) throw new BadRequestException("Este centro no participa en esta consultoría");
    return engagement;
  }

  async findEngagementCenters(id_consulting_client: number, id_annual_engagement: number) {
    await this.getValidatedEngagement(id_consulting_client, id_annual_engagement);
    return this.consultingEngagementCenterRepository.findByEngagementId(id_annual_engagement);
  }

  async addEngagementCenter(id_consulting_client: number, id_annual_engagement: number, dto: AddConsultingEngagementCenterDto) {
    await this.getValidatedEngagement(id_consulting_client, id_annual_engagement);
    await this.assertCenterBelongsToClient(id_consulting_client, dto.id_center);
    const existing = await this.consultingEngagementCenterRepository.findLink(id_annual_engagement, dto.id_center);
    if (existing) throw new ConflictException("Este centro ya participa en esta consultoría");
    return this.consultingEngagementCenterRepository.addCenter(id_annual_engagement, dto.id_center);
  }

  async removeEngagementCenter(id_consulting_client: number, id_annual_engagement: number, id_center: number) {
    await this.getValidatedEngagement(id_consulting_client, id_annual_engagement);
    return this.consultingEngagementCenterRepository.removeCenter(id_annual_engagement, id_center);
  }
}
