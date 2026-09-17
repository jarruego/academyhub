import { Body, Controller, Delete, Get, Param, Patch, ParseIntPipe, Post, Put, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { Public } from "src/guards/auth/public.guard";
import { ConsultingTokenGuard } from "src/guards/auth/consulting-token.guard";
import { ConsultingCentroService } from "./consultoria-centro.service";
import { CreateConsultingActionEvaluationDto } from "./dto/create-consulting-action-evaluation.dto";
import { UpdateConsultingActionEvaluationDto } from "./dto/update-consulting-action-evaluation.dto";
import { SetConsultingCompetencyEvaluationDto } from "./dto/set-consulting-competency-evaluation.dto";
import { CreateConsultingActionAttendeeDto } from "./dto/create-consulting-action-attendee.dto";

// Acceso externo de un centro a su propia consultoría, por token (nunca por
// JWT) — enlace humano `/consultoria-centro/:token` en el cliente. `@Public()`
// salta el `AuthGuard` global (JWT); `ConsultingTokenGuard` hace la
// autenticación real de estas rutas. Ver docs/consultoria.md.
@ApiTags("Consultoría — Acceso externo del centro")
@Public()
@Controller("api/consultoria/centro")
@UseGuards(ConsultingTokenGuard)
export class ConsultingCentroController {
  constructor(private readonly consultingCentroService: ConsultingCentroService) {}

  private idCenter(req: Request): number {
    return (req as unknown as { id_center: number }).id_center;
  }

  @Get("engagements")
  @ApiOperation({ summary: "Consultorías en las que participa este centro" })
  async listEngagements(@Req() req: Request) {
    return this.consultingCentroService.listEngagements(this.idCenter(req));
  }

  @Get("engagements/:id_annual_engagement/actions")
  @ApiOperation({ summary: "Plan efectivo de este centro (base + propio), para elegir qué acción evaluar" })
  async listActions(@Req() req: Request, @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number) {
    return this.consultingCentroService.listActions(this.idCenter(req), id_annual_engagement);
  }

  @Get("engagements/:id_annual_engagement/evaluations")
  @ApiOperation({ summary: "Evaluaciones de acciones formativas de este centro" })
  async listEvaluations(@Req() req: Request, @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number) {
    return this.consultingCentroService.listEvaluations(this.idCenter(req), id_annual_engagement);
  }

  @Post("engagements/:id_annual_engagement/evaluations")
  @ApiOperation({ summary: "Evaluar una acción del plan efectivo de este centro" })
  async createEvaluation(
    @Req() req: Request,
    @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number,
    @Body() dto: CreateConsultingActionEvaluationDto,
  ) {
    return this.consultingCentroService.createEvaluation(this.idCenter(req), id_annual_engagement, dto);
  }

  @Patch("engagements/:id_annual_engagement/evaluations/:id_action_evaluation")
  @ApiOperation({ summary: "Editar una evaluación" })
  async updateEvaluation(
    @Req() req: Request,
    @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number,
    @Param("id_action_evaluation", ParseIntPipe) id_action_evaluation: number,
    @Body() dto: UpdateConsultingActionEvaluationDto,
  ) {
    return this.consultingCentroService.updateEvaluation(this.idCenter(req), id_annual_engagement, id_action_evaluation, dto);
  }

  @Delete("engagements/:id_annual_engagement/evaluations/:id_action_evaluation")
  @ApiOperation({ summary: "Borrar una evaluación" })
  async removeEvaluation(
    @Req() req: Request,
    @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number,
    @Param("id_action_evaluation", ParseIntPipe) id_action_evaluation: number,
  ) {
    await this.consultingCentroService.removeEvaluation(this.idCenter(req), id_annual_engagement, id_action_evaluation);
    return { success: true };
  }

  @Get("engagements/:id_annual_engagement/roster")
  @ApiOperation({ summary: "Roster de este centro en esta consultoría (para elegir a quién evaluar o registrar como asistente)" })
  async getRoster(@Req() req: Request, @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number) {
    return this.consultingCentroService.getRoster(this.idCenter(req), id_annual_engagement);
  }

  @Get("engagements/:id_annual_engagement/competencies")
  @ApiOperation({ summary: "Roster de este centro con las 25 competencias de cada trabajador" })
  async getCompetencies(@Req() req: Request, @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number) {
    return this.consultingCentroService.getCompetencies(this.idCenter(req), id_annual_engagement);
  }

  @Put("engagements/:id_annual_engagement/competencies/:id_user/:id_competency")
  @ApiOperation({ summary: "Fijar el valor de una competencia de un trabajador de este centro" })
  async setCompetency(
    @Req() req: Request,
    @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number,
    @Param("id_user", ParseIntPipe) id_user: number,
    @Param("id_competency", ParseIntPipe) id_competency: number,
    @Body() dto: SetConsultingCompetencyEvaluationDto,
  ) {
    return this.consultingCentroService.setCompetency(this.idCenter(req), id_annual_engagement, id_user, id_competency, dto);
  }

  @Get("engagements/:id_annual_engagement/cuadro")
  @ApiOperation({ summary: "Cuadro de formación de este centro: cruce trabajador × acción (real o registrado a mano)" })
  async getCuadro(@Req() req: Request, @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number) {
    return this.consultingCentroService.getCuadro(this.idCenter(req), id_annual_engagement);
  }

  @Post("engagements/:id_annual_engagement/attendees")
  @ApiOperation({ summary: "Registrar a mano un asistente de una acción propia de este centro (sin matrícula real)" })
  async addAttendee(
    @Req() req: Request,
    @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number,
    @Body() dto: CreateConsultingActionAttendeeDto,
  ) {
    return this.consultingCentroService.addAttendee(this.idCenter(req), id_annual_engagement, dto);
  }

  @Delete("engagements/:id_annual_engagement/attendees/:id_action_attendee")
  @ApiOperation({ summary: "Quitar un asistente registrado a mano" })
  async removeAttendee(
    @Req() req: Request,
    @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number,
    @Param("id_action_attendee", ParseIntPipe) id_action_attendee: number,
  ) {
    await this.consultingCentroService.removeAttendee(this.idCenter(req), id_annual_engagement, id_action_attendee);
    return { success: true };
  }
}
