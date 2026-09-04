import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { JwtPayload } from "src/auth/auth.service";
import { Role } from "src/guards/role.enum";
import { RoleGuard } from "src/guards/role.guard";
import { CourseCandidateService } from "./course-candidate.service";
import { CreateCourseCandidateDto } from "./dto/create-course-candidate.dto";
import { UpdateCourseCandidatesDto } from "./dto/update-course-candidates.dto";

@Controller("course-candidates")
@UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER, Role.TUTOR]))
export class CourseCandidateController {
  constructor(private readonly service: CourseCandidateService) {}

  @Get()
  findByCourse(@Query("id_course", ParseIntPipe) idCourse: number) {
    return this.service.findByCourse(idCourse);
  }

  @Post()
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.TUTOR]))
  create(@Body() dto: CreateCourseCandidateDto, @Req() req: { user: JwtPayload }) {
    return this.service.create(dto, req.user?.id);
  }

  @Delete(":id")
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.TUTOR]))
  delete(@Param("id", ParseIntPipe) id: number, @Query("force") force?: string) {
    return this.service.delete(id, force === "true");
  }

  @Put("bulk")
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.TUTOR]))
  updateMany(@Body() dto: UpdateCourseCandidatesDto) {
    return this.service.updateMany(dto);
  }
}
