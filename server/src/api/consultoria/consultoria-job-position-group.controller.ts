import { Body, Controller, Delete, Get, Param, Patch, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { ConsultingJobPositionGroupService } from "./consultoria-job-position-group.service";
import { CreateConsultingJobPositionGroupDto } from "./dto/create-consulting-job-position-group.dto";
import { UpdateConsultingJobPositionGroupDto } from "./dto/update-consulting-job-position-group.dto";

// Grupos de puestos de trabajo — agrupación puramente visual del catálogo
// de puestos (p. ej. "Dirección", "Cuidados"). Gestión ADMIN-only;
// ADMIN/CONSULTOR pueden leerlo para elegir el grupo de un puesto — ver
// docs/consultoria.md.
@ApiTags("Consultoría — Grupos de puestos de trabajo")
@ApiBearerAuth()
@Controller("api/consultoria/job-position-groups")
@UseGuards(RoleGuard([Role.ADMIN, Role.CONSULTOR]))
export class ConsultingJobPositionGroupController {
  constructor(private readonly consultingJobPositionGroupService: ConsultingJobPositionGroupService) {}

  @Post()
  @UseGuards(RoleGuard([Role.ADMIN]))
  @ApiOperation({ summary: "Crear un grupo de puestos de trabajo" })
  async create(@Body() dto: CreateConsultingJobPositionGroupDto) {
    return this.consultingJobPositionGroupService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "Listar grupos de puestos de trabajo" })
  async findAll() {
    return this.consultingJobPositionGroupService.findAll();
  }

  @Patch(":id")
  @UseGuards(RoleGuard([Role.ADMIN]))
  @ApiOperation({ summary: "Editar un grupo de puestos de trabajo" })
  async update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateConsultingJobPositionGroupDto) {
    return this.consultingJobPositionGroupService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(RoleGuard([Role.ADMIN]))
  @ApiOperation({ summary: "Borrar un grupo de puestos de trabajo" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.consultingJobPositionGroupService.remove(id);
  }
}
