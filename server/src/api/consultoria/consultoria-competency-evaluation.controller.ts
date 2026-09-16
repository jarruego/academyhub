import { Body, Controller, Get, Param, Put, ParseIntPipe, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { ConsultingCompetencyEvaluationService } from "./consultoria-competency-evaluation.service";
import { SetConsultingCompetencyEvaluationDto } from "./dto/set-consulting-competency-evaluation.dto";
import { JwtPayload } from "src/auth/auth.service";

// Evaluación de competencias de los trabajadores de un centro, dentro de una
// consultoría anual concreta — nunca inferida (mismo patrón que Evaluación
// de acciones y Cuadro). Ver docs/consultoria.md.
@ApiTags("Consultoría — Evaluación de competencias")
@ApiBearerAuth()
@Controller("api/consultoria/clients/:id/annual-engagements/:id_annual_engagement/centers/:id_center/competencies")
@UseGuards(RoleGuard([Role.ADMIN, Role.CONSULTOR]))
export class ConsultingCompetencyEvaluationController {
  constructor(private readonly consultingCompetencyEvaluationService: ConsultingCompetencyEvaluationService) {}

  @Get()
  @ApiOperation({ summary: "Roster del centro con las 25 competencias de cada trabajador" })
  async getRosterWithCompetencies(
    @Param("id", ParseIntPipe) id_consulting_client: number,
    @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number,
    @Param("id_center", ParseIntPipe) id_center: number,
  ) {
    return this.consultingCompetencyEvaluationService.getRosterWithCompetencies(id_consulting_client, id_annual_engagement, id_center);
  }

  @Put(":id_user/:id_competency")
  @ApiOperation({ summary: "Fijar el valor de una competencia de un trabajador" })
  async setValue(
    @Param("id", ParseIntPipe) id_consulting_client: number,
    @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number,
    @Param("id_center", ParseIntPipe) id_center: number,
    @Param("id_user", ParseIntPipe) id_user: number,
    @Param("id_competency", ParseIntPipe) id_competency: number,
    @Body() dto: SetConsultingCompetencyEvaluationDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.consultingCompetencyEvaluationService.setValue(id_consulting_client, id_annual_engagement, id_center, id_user, id_competency, dto, req.user?.id);
  }
}
