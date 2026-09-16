import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { ConsultingJobPositionAliasService } from "./consultoria-job-position-alias.service";
import { UpsertConsultingJobPositionAliasDto } from "./dto/upsert-consulting-job-position-alias.dto";

// Mapea el texto libre de `user.job_position` al puesto del catálogo de 28 —
// mantenido solo por ADMIN (`user.job_position` es poco fiable, ver
// docs/consultoria.md).
@ApiTags("Consultoría — Alias de puesto de trabajo")
@ApiBearerAuth()
@Controller("api/consultoria/job-position-aliases")
@UseGuards(RoleGuard([Role.ADMIN]))
export class ConsultingJobPositionAliasController {
  constructor(private readonly consultingJobPositionAliasService: ConsultingJobPositionAliasService) {}

  @Get()
  @ApiOperation({ summary: "Listar los alias ya mapeados" })
  async findAll() {
    return this.consultingJobPositionAliasService.findAll();
  }

  @Get("unmapped")
  @ApiOperation({ summary: "Listar valores de job_position todavía sin mapear" })
  async findUnmapped() {
    return this.consultingJobPositionAliasService.findUnmapped();
  }

  @Post()
  @ApiOperation({ summary: "Mapear (o remapear) un valor de job_position a un puesto del catálogo" })
  async upsert(@Body() dto: UpsertConsultingJobPositionAliasDto) {
    return this.consultingJobPositionAliasService.upsert(dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Quitar un mapeo" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.consultingJobPositionAliasService.remove(id);
  }
}
