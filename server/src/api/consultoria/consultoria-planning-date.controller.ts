import { Body, Controller, Get, Param, Patch, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { ConsultingPlanningDateService } from "./consultoria-planning-date.service";
import { CreateConsultingPlanningDateDto } from "./dto/create-consulting-planning-date.dto";
import { UpdateConsultingPlanningDateDto } from "./dto/update-consulting-planning-date.dto";

// Catálogo de valores de "Fecha" de una acción formativa (A demanda, Según
// calendario central...). Gestión ADMIN-only; ADMIN/CONSULTOR pueden leerlo
// para etiquetar una acción — ver docs/consultoria.md.
@ApiTags("Consultoría — Fechas de planificación")
@ApiBearerAuth()
@Controller("api/consultoria/planning-dates")
@UseGuards(RoleGuard([Role.ADMIN, Role.CONSULTOR]))
export class ConsultingPlanningDateController {
  constructor(private readonly consultingPlanningDateService: ConsultingPlanningDateService) {}

  @Post()
  @UseGuards(RoleGuard([Role.ADMIN]))
  @ApiOperation({ summary: "Crear un valor de fecha de planificación" })
  async create(@Body() dto: CreateConsultingPlanningDateDto) {
    return this.consultingPlanningDateService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "Listar valores de fecha de planificación" })
  async findAll() {
    return this.consultingPlanningDateService.findAll();
  }

  @Patch(":id")
  @UseGuards(RoleGuard([Role.ADMIN]))
  @ApiOperation({ summary: "Editar un valor de fecha de planificación" })
  async update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateConsultingPlanningDateDto) {
    return this.consultingPlanningDateService.update(id, dto);
  }
}
