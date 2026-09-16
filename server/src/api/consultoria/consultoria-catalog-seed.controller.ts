import { Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { ConsultingCatalogSeedService } from "./consultoria-catalog-seed.service";

// TEMPORAL — ver cabecera de consultoria-catalog-seed.data.ts. ADMIN-only
// (rellena/toca el catálogo real). Borrar junto con el servicio, los datos,
// el botón del frontend y el script standalone cuando el usuario avise.
@ApiTags("Consultoría — Autorrelleno de catálogo (temporal)")
@ApiBearerAuth()
@Controller("api/consultoria/catalog-seed")
@UseGuards(RoleGuard([Role.ADMIN]))
export class ConsultingCatalogSeedController {
  constructor(private readonly consultingCatalogSeedService: ConsultingCatalogSeedService) {}

  @Post("fill")
  @ApiOperation({ summary: "[Temporal] Autorrellenar competencias/puestos del borrador" })
  async fill() {
    return this.consultingCatalogSeedService.fillCatalog();
  }

  @Post("automap-job-positions")
  @ApiOperation({ summary: "[Temporal] Automapear job_position reales sin alias, por palabra clave" })
  async automapJobPositions() {
    return this.consultingCatalogSeedService.autoMapJobPositions();
  }
}
