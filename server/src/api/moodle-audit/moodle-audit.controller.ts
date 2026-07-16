import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { MoodleAuditService } from "./moodle-audit.service";
import { FixUsernamesDto } from "./dto/fix-usernames.dto";

@Controller("api/moodle-audit")
@UseGuards(RoleGuard([Role.ADMIN]))
export class MoodleAuditController {
  constructor(private readonly moodleAuditService: MoodleAuditService) {}

  // Informe recalculado contra la BD local con el snapshot cacheado. 0 llamadas
  // a Moodle; si no hay snapshot devuelve hasSnapshot=false.
  @Get("report")
  async report() {
    return this.moodleAuditService.getReport();
  }

  // Descarga el snapshot de usuarios de Moodle (~1 + N/200 llamadas) y devuelve
  // el informe. POST a propósito: consume cuota y queda en audit_log.
  @Post("refresh")
  async refresh() {
    return this.moodleAuditService.refreshSnapshot();
  }

  // Corrige moodle_usernames desactualizados copiando el real del snapshot
  // (server-authoritative). Sin body corrige todos; con idMoodleUsers, solo esos.
  @Post("fix-usernames")
  async fixUsernames(@Body() body: FixUsernamesDto) {
    return this.moodleAuditService.fixUsernames(body.idMoodleUsers);
  }

  // Reasigna un vínculo incorrecto al usuario correcto por DNI sin fusionar
  // fichas (mueve la cuenta de Moodle, sus matrículas y las membresías de esos
  // cursos; no borra a nadie). El destino lo deriva el servidor del snapshot.
  // ID en la ruta para que quede en audit_log.
  @Post("relink/:idMoodleUser")
  async relink(@Param("idMoodleUser", ParseIntPipe) idMoodleUser: number) {
    return this.moodleAuditService.relink(idMoodleUser);
  }

  // Limpia un vínculo huérfano. ID en la ruta para que quede en audit_log.
  @Delete("orphans/:idMoodleUser")
  async cleanupOrphan(@Param("idMoodleUser", ParseIntPipe) idMoodleUser: number) {
    return this.moodleAuditService.cleanupOrphan(idMoodleUser);
  }
}
