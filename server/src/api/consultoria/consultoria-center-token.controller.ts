import { Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { ConsultingCenterTokenService } from "./consultoria-center-token.service";

// Gestión del token de acceso externo de un centro — desde su ficha
// (/centers/:id/edit). ADMIN-only: revocarlo/regenerarlo afecta al acceso
// del centro a toda su consultoría. Ver docs/consultoria.md.
@ApiTags("Consultoría — Token de acceso del centro")
@ApiBearerAuth()
@Controller("api/consultoria/centers/:id_center/token")
@UseGuards(RoleGuard([Role.ADMIN]))
export class ConsultingCenterTokenController {
  constructor(private readonly consultingCenterTokenService: ConsultingCenterTokenService) {}

  @Get()
  @ApiOperation({ summary: "Estado del token de este centro, incluido el token en claro (descifrado con APP_MASTER_KEY)" })
  async getStatus(@Param("id_center", ParseIntPipe) id_center: number) {
    return this.consultingCenterTokenService.getStatus(id_center);
  }

  @Post()
  @ApiOperation({ summary: "Generar o regenerar el token — invalida el anterior al momento" })
  async issue(@Param("id_center", ParseIntPipe) id_center: number) {
    return this.consultingCenterTokenService.issue(id_center);
  }

  @Delete()
  @ApiOperation({ summary: "Revocar el token — el enlace deja de funcionar al momento" })
  async revoke(@Param("id_center", ParseIntPipe) id_center: number) {
    return this.consultingCenterTokenService.revoke(id_center);
  }
}
