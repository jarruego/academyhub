import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { Role } from "src/guards/role.enum";
import { RoleGuard } from "src/guards/role.guard";
import { CourseCatalogService } from "./course-catalog.service";
import { CreateCatalogCourseDto } from "./dto/create-catalog-course.dto";
import { MergeCatalogCourseDto } from "./dto/merge-catalog-course.dto";
import { UpdateCatalogCourseDto } from "./dto/update-catalog-course.dto";

@Controller("course-catalog")
export class CourseCatalogController {
  constructor(private readonly service: CourseCatalogService) {}

  @Get()
  findAll(@Query("search") search?: string) {
    return this.service.findAll(search);
  }

  @Get(":id")
  findById(@Param("id") id: string) {
    return this.service.findById(Number(id));
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Post()
  create(@Body() dto: CreateCatalogCourseDto) {
    return this.service.create(dto);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCatalogCourseDto) {
    return this.service.update(Number(id), dto);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Post(":id/merge")
  merge(@Param("id") id: string, @Body() dto: MergeCatalogCourseDto) {
    return this.service.merge(Number(id), dto.target_id);
  }
}
