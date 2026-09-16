import { Body, Controller, Delete, Get, Param, Put, ParseIntPipe, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { JwtPayload } from "src/auth/auth.service";
import { ConsultingCuadroService } from "./consultoria-cuadro.service";
import { UpsertConsultingRosterAdjustmentDto } from "./dto/upsert-consulting-roster-adjustment.dto";
import { CreateConsultingActionAttendeeDto } from "./dto/create-consulting-action-attendee.dto";

// Cuadro de formación: cruce trabajador × acción (automático si hay
// matrícula real, manual si no) + roster ajustable — vive siempre dentro de
// una consultoría anual (del cliente) y de un centro concreto que participa
// en ella. Ver docs/consultoria.md § Cuadro de formación por centro.
@ApiTags("Consultoría — Cuadro de formación")
@ApiBearerAuth()
@Controller("api/consultoria/clients/:id/annual-engagements/:id_annual_engagement/centers/:id_center")
@UseGuards(RoleGuard([Role.ADMIN, Role.CONSULTOR]))
export class ConsultingCuadroController {
  constructor(private readonly consultingCuadroService: ConsultingCuadroService) {}

  @Get("roster")
  @ApiOperation({ summary: "Roster efectivo del centro (real + ajustes) en esta consultoría" })
  async getRoster(
    @Param("id", ParseIntPipe) id: number,
    @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number,
    @Param("id_center", ParseIntPipe) id_center: number,
  ) {
    return this.consultingCuadroService.getRoster(id, id_annual_engagement, id_center);
  }

  @Put("roster/:id_user")
  @ApiOperation({ summary: "Añadir o quitar (a mano) un trabajador del roster de esta consultoría, sin tocar user_center" })
  async setRosterAdjustment(
    @Param("id", ParseIntPipe) id: number,
    @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number,
    @Param("id_center", ParseIntPipe) id_center: number,
    @Param("id_user", ParseIntPipe) id_user: number,
    @Body() dto: UpsertConsultingRosterAdjustmentDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.consultingCuadroService.setRosterAdjustment(id, id_annual_engagement, id_center, id_user, dto, req.user?.id);
  }

  @Delete("roster/adjustments/:id_roster_adjustment")
  @ApiOperation({ summary: "Quitar un ajuste de roster (vuelve al estado real)" })
  async removeRosterAdjustment(
    @Param("id", ParseIntPipe) id: number,
    @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number,
    @Param("id_center", ParseIntPipe) id_center: number,
    @Param("id_roster_adjustment", ParseIntPipe) id_roster_adjustment: number,
  ) {
    return this.consultingCuadroService.removeRosterAdjustment(id, id_annual_engagement, id_center, id_roster_adjustment);
  }

  @Get("cuadro")
  @ApiOperation({ summary: "Cuadro de formación de este centro, en esta consultoría: cruce trabajador × acción (real o manual)" })
  async getCuadro(
    @Param("id", ParseIntPipe) id: number,
    @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number,
    @Param("id_center", ParseIntPipe) id_center: number,
  ) {
    return this.consultingCuadroService.getCuadro(id, id_annual_engagement, id_center);
  }

  @Post("attendees")
  @ApiOperation({ summary: "Registrar a mano un asistente de una acción sin matrícula real (externa o sin catalogar)" })
  async addAttendee(
    @Param("id", ParseIntPipe) id: number,
    @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number,
    @Param("id_center", ParseIntPipe) id_center: number,
    @Body() dto: CreateConsultingActionAttendeeDto,
    @Req() req: { user: JwtPayload },
  ) {
    return this.consultingCuadroService.addAttendee(id, id_annual_engagement, id_center, dto, req.user?.id);
  }

  @Delete("attendees/:id_action_attendee")
  @ApiOperation({ summary: "Quitar un asistente registrado a mano" })
  async removeAttendee(
    @Param("id", ParseIntPipe) id: number,
    @Param("id_annual_engagement", ParseIntPipe) id_annual_engagement: number,
    @Param("id_center", ParseIntPipe) id_center: number,
    @Param("id_action_attendee", ParseIntPipe) id_action_attendee: number,
  ) {
    return this.consultingCuadroService.removeAttendee(id, id_annual_engagement, id_center, id_action_attendee);
  }
}
