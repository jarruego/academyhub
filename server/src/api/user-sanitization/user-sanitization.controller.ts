import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { UserSanitizationService } from "./user-sanitization.service";
import { FixIssueDto } from "./dto/fix-issue.dto";
import { ManualFixDto } from "./dto/manual-fix.dto";

@Controller("api/user-sanitization")
@UseGuards(RoleGuard([Role.ADMIN]))
export class UserSanitizationController {
  constructor(private readonly userSanitizationService: UserSanitizationService) {}

  // Usuarios con campos presentes-pero-inválidos (teléfono/email/dni/nss).
  @Get("issues")
  async issues() {
    return this.userSanitizationService.getIssues();
  }

  // Corrige automáticamente un campo saneable. El id va en la ruta (audit_log).
  @Post(":id/fix")
  async fix(@Param("id", ParseIntPipe) id: number, @Body() body: FixIssueDto) {
    return this.userSanitizationService.fix(id, body.field);
  }

  // Corrige a mano un campo (incluido dni) con un valor validado en el servidor.
  @Post(":id/manual")
  async manualFix(@Param("id", ParseIntPipe) id: number, @Body() body: ManualFixDto) {
    return this.userSanitizationService.manualFix(id, body.field, body.value);
  }

  // Corrige en bloque todos los valores auto-corregibles de un campo.
  @Post("fix-all")
  async fixAll(@Body() body: FixIssueDto) {
    return this.userSanitizationService.fixAll(body.field);
  }
}
