import { Body, Controller, Delete, Get, Param, Patch, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { ConsultingCompetencyService } from "./consultoria-competency.service";
import { CreateConsultingCompetencyDto } from "./dto/create-consulting-competency.dto";
import { UpdateConsultingCompetencyDto } from "./dto/update-consulting-competency.dto";

// Catálogo de las 25 competencias evaluables por trabajador. Gestión
// ADMIN-only; ADMIN/CONSULTOR pueden leerlo (configurador, evaluación) — ver
// docs/consultoria.md.
@ApiTags("Consultoría — Competencias")
@ApiBearerAuth()
@Controller("api/consultoria/competencies")
@UseGuards(RoleGuard([Role.ADMIN, Role.CONSULTOR]))
export class ConsultingCompetencyController {
  constructor(private readonly consultingCompetencyService: ConsultingCompetencyService) {}

  @Post()
  @UseGuards(RoleGuard([Role.ADMIN]))
  @ApiOperation({ summary: "Crear una competencia" })
  async create(@Body() dto: CreateConsultingCompetencyDto) {
    return this.consultingCompetencyService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "Listar competencias" })
  async findAll() {
    return this.consultingCompetencyService.findAll();
  }

  @Patch(":id")
  @UseGuards(RoleGuard([Role.ADMIN]))
  @ApiOperation({ summary: "Editar una competencia" })
  async update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateConsultingCompetencyDto) {
    return this.consultingCompetencyService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(RoleGuard([Role.ADMIN]))
  @ApiOperation({ summary: "Borrar una competencia" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.consultingCompetencyService.remove(id);
  }
}
