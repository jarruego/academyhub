import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { JwtPayload } from "src/auth/auth.service";
import { Role } from "src/guards/role.enum";
import { RoleGuard } from "src/guards/role.guard";
import { InterestStatus } from "src/types/course-interest/course-interest.enums";
import { CourseInterestService } from "./course-interest.service";
import { CreateCourseInterestDto } from "./dto/create-course-interest.dto";
import { IncorporateInterestsDto } from "./dto/incorporate-interests.dto";
import { UpdateCourseInterestsDto } from "./dto/update-course-interests.dto";

@Controller("course-interests")
@UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER, Role.TUTOR]))
export class CourseInterestController {
  constructor(private readonly service: CourseInterestService) {}

  @Get()
  findAll(
    @Query("id_catalog_course") idCatalogCourse?: string,
    @Query("status") status?: InterestStatus,
    @Query("assigned_to") assignedTo?: string,
  ) {
    if (idCatalogCourse && !status && !assignedTo) {
      return this.service.findByCatalogCourse(Number(idCatalogCourse));
    }
    return this.service.findAll({
      id_catalog_course: idCatalogCourse ? Number(idCatalogCourse) : undefined,
      status,
      assigned_to: assignedTo ? Number(assignedTo) : undefined,
    });
  }

  @Post()
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  create(@Body() dto: CreateCourseInterestDto, @Req() req: { user: JwtPayload }) {
    return this.service.create(dto, req.user?.id);
  }

  @Put("bulk")
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  updateMany(@Body() dto: UpdateCourseInterestsDto) {
    return this.service.updateMany(dto);
  }

  @Post("incorporate")
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  incorporate(@Body() dto: IncorporateInterestsDto, @Req() req: { user: JwtPayload }) {
    return this.service.incorporate(dto, req.user?.id);
  }

  @Delete(":id")
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  delete(@Param("id", ParseIntPipe) id: number) {
    return this.service.delete(id);
  }
}
