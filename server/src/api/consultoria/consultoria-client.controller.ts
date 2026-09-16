import { Body, Controller, Delete, Get, Param, Patch, ParseIntPipe, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { JwtPayload } from "src/auth/auth.service";
import { ConsultingClientService } from "./consultoria-client.service";
import { CreateConsultingClientDto } from "./dto/create-consulting-client.dto";
import { UpdateConsultingClientDto } from "./dto/update-consulting-client.dto";
import { AddConsultingClientCompanyDto } from "./dto/add-consulting-client-company.dto";
import { CreateConsultingPlanItemDto } from "./dto/create-consulting-plan-item.dto";
import { OpenConsultingAnnualEngagementDto } from "./dto/open-consulting-annual-engagement.dto";
import { UpdateConsultingAnnualEngagementDto } from "./dto/update-consulting-annual-engagement.dto";
import { AddConsultingEngagementCenterDto } from "./dto/add-consulting-engagement-center.dto";

// Ver docs/consultoria.md — apartado nuevo, ADMIN y CONSULTOR con el mismo acceso.
@ApiTags("Consultoría — Clientes")
@ApiBearerAuth()
@Controller("api/consultoria/clients")
@UseGuards(RoleGuard([Role.ADMIN, Role.CONSULTOR]))
export class ConsultingClientController {
  constructor(private readonly consultingClientService: ConsultingClientService) {}

  @Post()
  @ApiOperation({ summary: "Dar de alta un cliente a auditar" })
  async create(@Body() dto: CreateConsultingClientDto) {
    return this.consultingClientService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "Listar clientes a auditar" })
  async findAll() {
    return this.consultingClientService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Ficha de un cliente a auditar" })
  async findById(@Param("id", ParseIntPipe) id: number) {
    return this.consultingClientService.findById(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Editar el nombre de un cliente a auditar" })
  async update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateConsultingClientDto) {
    return this.consultingClientService.update(id, dto);
  }

  @Get(":id/companies")
  @ApiOperation({ summary: "Empresas vinculadas a un cliente" })
  async findCompanies(@Param("id", ParseIntPipe) id: number) {
    return this.consultingClientService.findCompanies(id);
  }

  @Post(":id/companies")
  @ApiOperation({ summary: "Vincular una empresa (ya existente) a un cliente" })
  async addCompany(@Param("id", ParseIntPipe) id: number, @Body() dto: AddConsultingClientCompanyDto) {
    return this.consultingClientService.addCompany(id, dto);
  }

  @Delete(":id/companies/:id_company")
  @ApiOperation({ summary: "Desvincular una empresa de un cliente" })
  async removeCompany(@Param("id", ParseIntPipe) id: number, @Param("id_company", ParseIntPipe) id_company: number) {
    await this.consultingClientService.removeCompany(id, id_company);
    return { success: true };
  }

  @Get(":id/plan-items")
  @ApiOperation({ summary: "Plan de formación de un cliente: base + propio de cada centro" })
  async findPlanItems(@Param("id", ParseIntPipe) id: number) {
    return this.consultingClientService.findPlanItems(id);
  }

  @Post(":id/plan-items")
  @ApiOperation({ summary: "Añadir una acción formativa al plan (base, o de un centro concreto)" })
  async addPlanItem(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateConsultingPlanItemDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.consultingClientService.addPlanItem(id, dto, req.user?.id);
  }

  @Delete(":id/plan-items/:id_plan_item")
  @ApiOperation({ summary: "Quitar una acción formativa del plan" })
  async removePlanItem(@Param("id", ParseIntPipe) id: number, @Param("id_plan_item", ParseIntPipe) id_plan_item: number) {
    await this.consultingClientService.removePlanItem(id, id_plan_item);
    return { success: true };
  }

  @Get(":id/annual-engagements")
  @ApiOperation({ summary: "Consultorías anuales de un cliente (una por año)" })
  async findAnnualEngagements(@Param("id", ParseIntPipe) id: number) {
    return this.consultingClientService.findAnnualEngagements(id);
  }

  @Post(":id/annual-engagements")
  @ApiOperation({ summary: "Abrir la consultoría de un año — por defecto incluye todos los centros del cliente" })
  async openAnnualEngagement(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: OpenConsultingAnnualEngagementDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.consultingClientService.openAnnualEngagement(id, dto, req.user?.id);
  }

  @Patch(":id/annual-engagements/:id_annual_engagement")
  @ApiOperation({ summary: "Cerrar o reabrir una consultoría anual" })
  async updateAnnualEngagement(
    @Param("id", ParseIntPipe) id: number,
    @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number,
    @Body() dto: UpdateConsultingAnnualEngagementDto,
  ) {
    return this.consultingClientService.updateAnnualEngagement(id, id_annual_engagement, dto);
  }

  @Get(":id/annual-engagements/:id_annual_engagement/centers")
  @ApiOperation({ summary: "Centros que participan en una consultoría anual" })
  async findEngagementCenters(@Param("id", ParseIntPipe) id: number, @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number) {
    return this.consultingClientService.findEngagementCenters(id, id_annual_engagement);
  }

  @Post(":id/annual-engagements/:id_annual_engagement/centers")
  @ApiOperation({ summary: "Añadir un centro a una consultoría anual" })
  async addEngagementCenter(
    @Param("id", ParseIntPipe) id: number,
    @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number,
    @Body() dto: AddConsultingEngagementCenterDto,
  ) {
    return this.consultingClientService.addEngagementCenter(id, id_annual_engagement, dto);
  }

  @Delete(":id/annual-engagements/:id_annual_engagement/centers/:id_center")
  @ApiOperation({ summary: "Quitar un centro de una consultoría anual" })
  async removeEngagementCenter(
    @Param("id", ParseIntPipe) id: number,
    @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number,
    @Param("id_center", ParseIntPipe) id_center: number,
  ) {
    await this.consultingClientService.removeEngagementCenter(id, id_annual_engagement, id_center);
    return { success: true };
  }
}
