import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { JwtPayload } from "src/auth/auth.service";
import { ConsultingPlanService } from "./consultoria-plan.service";
import { CreateConsultingPlanItemDto } from "./dto/create-consulting-plan-item.dto";
import { AddConsultingPlanItemToAllCentersDto } from "./dto/add-consulting-plan-item-to-all-centers.dto";

// Plan de formación de una consultoría anual concreta — base (compartido
// por los centros que participan) + propio de cada centro. Ver
// docs/consultoria.md.
@ApiTags("Consultoría — Plan")
@ApiBearerAuth()
@Controller("api/consultoria/clients/:id/annual-engagements/:id_annual_engagement/plan-items")
@UseGuards(RoleGuard([Role.ADMIN, Role.CONSULTOR]))
export class ConsultingPlanController {
  constructor(private readonly consultingPlanService: ConsultingPlanService) {}

  @Get()
  @ApiOperation({ summary: "Plan de esta consultoría: base + propio de cada centro" })
  async findByEngagement(@Param("id", ParseIntPipe) id: number, @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number) {
    return this.consultingPlanService.findByEngagement(id, id_annual_engagement);
  }

  @Post()
  @ApiOperation({ summary: "Añadir una acción formativa al plan (base, o de un centro concreto)" })
  async addPlanItem(
    @Param("id", ParseIntPipe) id: number,
    @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number,
    @Body() dto: CreateConsultingPlanItemDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.consultingPlanService.addPlanItem(id, id_annual_engagement, dto, req.user?.id);
  }

  @Post("all-centers")
  @ApiOperation({ summary: "Añadir una acción a cada centro de esta consultoría individualmente (no al plan base compartido)" })
  async addPlanItemToAllCenters(
    @Param("id", ParseIntPipe) id: number,
    @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number,
    @Body() dto: AddConsultingPlanItemToAllCentersDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.consultingPlanService.addPlanItemToAllCenters(id, id_annual_engagement, dto, req.user?.id);
  }

  @Delete(":id_plan_item")
  @ApiOperation({ summary: "Quitar una acción formativa del plan. `keep_for_centers=true` (solo plan base): reparte una copia propia a cada centro antes de borrar la fila base, en vez de bloquear/borrar del todo" })
  async removePlanItem(
    @Param("id", ParseIntPipe) id: number,
    @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number,
    @Param("id_plan_item", ParseIntPipe) id_plan_item: number,
    @Query("keep_for_centers") keepForCenters: string | undefined,
    @Req() req: { user: JwtPayload },
  ) {
    await this.consultingPlanService.removePlanItem(id, id_annual_engagement, id_plan_item, keepForCenters === 'true', req.user?.id);
    return { success: true };
  }
}
