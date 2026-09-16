import { Body, Controller, Delete, Get, Param, Patch, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { ConsultingJobPositionService } from "./consultoria-job-position.service";
import { CreateConsultingJobPositionDto } from "./dto/create-consulting-job-position.dto";
import { UpdateConsultingJobPositionDto } from "./dto/update-consulting-job-position.dto";

// Catálogo de los 28 puestos de trabajo con plantilla de competencias
// propia. Gestión ADMIN-only; ADMIN/CONSULTOR pueden leerlo — ver
// docs/consultoria.md.
@ApiTags("Consultoría — Puestos de trabajo")
@ApiBearerAuth()
@Controller("api/consultoria/job-positions")
@UseGuards(RoleGuard([Role.ADMIN, Role.CONSULTOR]))
export class ConsultingJobPositionController {
  constructor(private readonly consultingJobPositionService: ConsultingJobPositionService) {}

  @Post()
  @UseGuards(RoleGuard([Role.ADMIN]))
  @ApiOperation({ summary: "Crear un puesto de trabajo" })
  async create(@Body() dto: CreateConsultingJobPositionDto) {
    return this.consultingJobPositionService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "Listar puestos de trabajo" })
  async findAll() {
    return this.consultingJobPositionService.findAll();
  }

  @Patch(":id")
  @UseGuards(RoleGuard([Role.ADMIN]))
  @ApiOperation({ summary: "Editar un puesto de trabajo" })
  async update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateConsultingJobPositionDto) {
    return this.consultingJobPositionService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(RoleGuard([Role.ADMIN]))
  @ApiOperation({ summary: "Borrar un puesto de trabajo" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.consultingJobPositionService.remove(id);
  }
}
