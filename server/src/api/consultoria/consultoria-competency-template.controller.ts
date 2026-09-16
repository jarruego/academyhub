import { Body, Controller, Get, Param, Put, ParseIntPipe, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { ConsultingCompetencyTemplateService } from "./consultoria-competency-template.service";
import { SetConsultingCompetencyTemplateDto } from "./dto/set-consulting-competency-template.dto";

// Configurador puesto ↔ competencia: valor por defecto que autorrellena la
// evaluación de un trabajador según su puesto. ADMIN y CONSULTOR — ver
// docs/consultoria.md.
@ApiTags("Consultoría — Configurador de competencias por puesto")
@ApiBearerAuth()
@Controller("api/consultoria/job-positions/:id_job_position/competency-template")
@UseGuards(RoleGuard([Role.ADMIN, Role.CONSULTOR]))
export class ConsultingCompetencyTemplateController {
  constructor(private readonly consultingCompetencyTemplateService: ConsultingCompetencyTemplateService) {}

  @Get()
  @ApiOperation({ summary: "Ver la plantilla de competencias de un puesto" })
  async findForJobPosition(@Param("id_job_position", ParseIntPipe) id_job_position: number) {
    return this.consultingCompetencyTemplateService.findForJobPosition(id_job_position);
  }

  @Put(":id_competency")
  @ApiOperation({ summary: "Fijar el valor por defecto de una competencia para este puesto" })
  async set(
    @Param("id_job_position", ParseIntPipe) id_job_position: number,
    @Param("id_competency", ParseIntPipe) id_competency: number,
    @Body() dto: SetConsultingCompetencyTemplateDto,
  ) {
    return this.consultingCompetencyTemplateService.set(id_job_position, id_competency, dto);
  }
}
