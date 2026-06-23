import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { UserMergeService } from "./user-merge.service";
import { MergeUsersDto } from "./dto/merge-users.dto";

@Controller("api/user-merge")
@UseGuards(RoleGuard([Role.ADMIN]))
export class UserMergeController {
  constructor(private readonly userMergeService: UserMergeService) {}

  // Grupos de duplicados detectados por NSS normalizado.
  @Get("candidates")
  async candidates() {
    return this.userMergeService.getCandidates();
  }

  // Previsualización de una fusión concreta (no modifica nada).
  @Get("preview/:winnerId/:loserId")
  async preview(
    @Param("winnerId", ParseIntPipe) winnerId: number,
    @Param("loserId", ParseIntPipe) loserId: number,
  ) {
    return this.userMergeService.preview(winnerId, loserId);
  }

  // Ejecuta la fusión. IDs en la ruta para que queden en audit_log.
  @Post(":winnerId/:loserId")
  async merge(
    @Param("winnerId", ParseIntPipe) winnerId: number,
    @Param("loserId", ParseIntPipe) loserId: number,
    @Body() body: MergeUsersDto,
  ) {
    return this.userMergeService.merge(winnerId, loserId, body.fieldsFromLoser ?? []);
  }
}
