import { Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { JwtPayload } from "src/auth/auth.service";
import { Role } from "src/guards/role.enum";
import { RoleGuard } from "src/guards/role.guard";
import { CourseCandidateService } from "./course-candidate.service";
import { CreateCourseCandidateDto } from "./dto/create-course-candidate.dto";
import { UpdateCourseCandidatesDto } from "./dto/update-course-candidates.dto";

@Controller("course-candidates")
@UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER, Role.TUTOR, Role.CONSULTOR]))
export class CourseCandidateController {
  constructor(private readonly service: CourseCandidateService) {}

  @Get()
  findByCourse(@Query("id_course", ParseIntPipe) idCourse: number) {
    return this.service.findByCourse(idCourse);
  }

  // create/delete/updateMany: el guard de clase ya deja pasar a cualquier rol
  // autenticado; quien no sea ADMIN/MANAGER/TUTOR solo puede gestionar
  // candidaturas si tiene el permiso puntual `can_manage_candidates`
  // (auth_users.can_manage_candidates, ver docs/security.md).
  @Post()
  create(@Body() dto: CreateCourseCandidateDto, @Req() req: { user: JwtPayload }) {
    this.assertCanManage(req.user);
    return this.service.create(dto, req.user?.id);
  }

  @Delete(":id")
  delete(@Param("id", ParseIntPipe) id: number, @Query("force") force: string | undefined, @Req() req: { user: JwtPayload }) {
    this.assertCanManage(req.user);
    return this.service.delete(id, force === "true");
  }

  @Put("bulk")
  updateMany(@Body() dto: UpdateCourseCandidatesDto, @Req() req: { user: JwtPayload }) {
    this.assertCanManage(req.user);
    return this.service.updateMany(dto);
  }

  private assertCanManage(user: JwtPayload) {
    const hasAccess = [Role.ADMIN, Role.MANAGER, Role.TUTOR].includes(user.role) || user.can_manage_candidates;
    if (!hasAccess) throw new ForbiddenException("No tienes permiso para gestionar candidaturas.");
  }
}
