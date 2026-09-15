import { Body, Controller, Get, Param, Put, ParseIntPipe, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { JwtPayload } from "src/auth/auth.service";
import { ConsultingActionService } from "./consultoria-action.service";
import { UpsertConsultingActionDetailDto } from "./dto/upsert-consulting-action-detail.dto";

// Acciones formativas: etiqueta Consultoría (origen/categoría/fecha) sobre un
// curso de catálogo (`catalog_courses`) ya existente — no una edición
// concreta (`courses`); qué ediciones/alumnos/centros hicieron el curso y
// cuándo se resuelve más adelante, al construir el cuadro de formación. Ver
// docs/consultoria.md.
@ApiTags("Consultoría — Acciones formativas")
@ApiBearerAuth()
@Controller("api/consultoria/actions")
@UseGuards(RoleGuard([Role.ADMIN, Role.CONSULTOR]))
export class ConsultingActionController {
  constructor(private readonly consultingActionService: ConsultingActionService) {}

  @Get()
  @ApiOperation({ summary: "Listar acciones formativas ya etiquetadas" })
  async findAll() {
    return this.consultingActionService.findAll();
  }

  @Get(":id_catalog_course")
  @ApiOperation({ summary: "Ver la etiqueta de Consultoría de un curso de catálogo" })
  async findByCatalogCourseId(@Param("id_catalog_course", ParseIntPipe) id_catalog_course: number) {
    return this.consultingActionService.findByCatalogCourseId(id_catalog_course);
  }

  @Put(":id_catalog_course")
  @ApiOperation({ summary: "Etiquetar (o editar) un curso de catálogo existente como acción formativa" })
  async upsert(
    @Param("id_catalog_course", ParseIntPipe) id_catalog_course: number,
    @Body() dto: UpsertConsultingActionDetailDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.consultingActionService.upsert(id_catalog_course, dto, req.user?.id);
  }
}
