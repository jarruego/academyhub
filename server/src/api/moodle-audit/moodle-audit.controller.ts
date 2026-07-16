import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { MoodleAuditService } from "./moodle-audit.service";
import { FixUsernamesDto } from "./dto/fix-usernames.dto";
import { DeleteMoodleUsersDto } from "./dto/delete-moodle-users.dto";

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

  // Descarga el snapshot de matrículas de Moodle (1 llamada por curso + 1 para
  // el catálogo) y devuelve el informe con los candidatos a limpieza.
  @Post("refresh-enrolments")
  async refreshEnrolments() {
    return this.moodleAuditService.refreshEnrolments();
  }

  // Sincroniza a la BD el estado de las cuentas según el snapshot (0 llamadas):
  // suspended espejo de Moodle y lápida deleted_in_moodle_at para las borradas.
  @Post("sync-status")
  async syncStatus() {
    return this.moodleAuditService.syncStatus();
  }

  // Borra usuarios EN MOODLE (irreversible) y marca la lápida local. Solo
  // acepta candidatos sin cursos y no protegidos (validación server-side).
  @Post("delete-users")
  async deleteFromMoodle(@Body() body: DeleteMoodleUsersDto) {
    return this.moodleAuditService.deleteFromMoodle(body.moodleIds);
  }

  // Marca una cuenta de Moodle como intocable para la limpieza (idempotente).
  // ID en la ruta para que quede en audit_log.
  @Post("protected/:moodleId")
  async protect(@Param("moodleId", ParseIntPipe) moodleId: number) {
    return this.moodleAuditService.protectMoodleUser(moodleId);
  }

  // Retira la protección manual de una cuenta de Moodle (idempotente).
  @Delete("protected/:moodleId")
  async unprotect(@Param("moodleId", ParseIntPipe) moodleId: number) {
    return this.moodleAuditService.unprotectMoodleUser(moodleId);
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
