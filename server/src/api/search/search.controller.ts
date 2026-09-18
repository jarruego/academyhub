import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { SearchService } from "./search.service";

// Sin RoleGuard propio (solo el AuthGuard global): GET de solo lectura, sin
// datos más sensibles de los que ya expone cada listado (usuarios/ediciones/
// empresas/centros), y debe ser visible a cualquier rol autenticado — lo
// consume el buscador global del dashboard Home, que también es visible a
// todos. Ver docs/client.md "Buscador global del dashboard".
@ApiTags("Search")
@ApiBearerAuth()
@Controller("api/search")
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Get()
  @ApiOperation({ summary: "Búsqueda global (usuarios, ediciones, empresas, centros) para el dashboard Home" })
  search(@Query("q") q?: string) {
    return this.service.search(q ?? "");
  }
}
