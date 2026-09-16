import { Body, Controller, Delete, Get, Param, Patch, ParseIntPipe, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { JwtPayload } from "src/auth/auth.service";
import { ConsultingEvaluationService } from "./consultoria-evaluation.service";
import { CreateConsultingActionEvaluationDto } from "./dto/create-consulting-action-evaluation.dto";
import { UpdateConsultingActionEvaluationDto } from "./dto/update-consulting-action-evaluation.dto";

// Evaluación de las acciones formativas del plan — vive siempre dentro de
// una consultoría anual (del cliente) y de un centro concreto, nunca
// inferido. Ver docs/consultoria.md.
@ApiTags("Consultoría — Evaluación de acciones")
@ApiBearerAuth()
@Controller("api/consultoria/clients/:id/annual-engagements/:id_annual_engagement/centers/:id_center/evaluations")
@UseGuards(RoleGuard([Role.ADMIN, Role.CONSULTOR]))
export class ConsultingEvaluationController {
  constructor(private readonly consultingEvaluationService: ConsultingEvaluationService) {}

  @Get()
  @ApiOperation({ summary: "Evaluaciones de acciones formativas de este centro, en esta consultoría" })
  async findAll(
    @Param("id", ParseIntPipe) id: number,
    @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number,
    @Param("id_center", ParseIntPipe) id_center: number,
  ) {
    return this.consultingEvaluationService.findByEngagementCenter(id, id_annual_engagement, id_center);
  }

  @Post()
  @ApiOperation({ summary: "Evaluar una acción formativa del plan de este centro, dentro de esta consultoría" })
  async create(
    @Param("id", ParseIntPipe) id: number,
    @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number,
    @Param("id_center", ParseIntPipe) id_center: number,
    @Body() dto: CreateConsultingActionEvaluationDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.consultingEvaluationService.create(id, id_annual_engagement, id_center, dto, req.user?.id);
  }

  @Patch(":id_action_evaluation")
  @ApiOperation({ summary: "Editar una evaluación" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number,
    @Param("id_center", ParseIntPipe) id_center: number,
    @Param("id_action_evaluation", ParseIntPipe) id_action_evaluation: number,
    @Body() dto: UpdateConsultingActionEvaluationDto,
  ) {
    return this.consultingEvaluationService.update(id, id_annual_engagement, id_center, id_action_evaluation, dto);
  }

  @Delete(":id_action_evaluation")
  @ApiOperation({ summary: "Borrar una evaluación" })
  async remove(
    @Param("id", ParseIntPipe) id: number,
    @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number,
    @Param("id_center", ParseIntPipe) id_center: number,
    @Param("id_action_evaluation", ParseIntPipe) id_action_evaluation: number,
  ) {
    await this.consultingEvaluationService.remove(id, id_annual_engagement, id_center, id_action_evaluation);
    return { success: true };
  }
}
