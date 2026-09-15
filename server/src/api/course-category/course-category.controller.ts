import { Body, Controller, Get, Param, Patch, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { CourseCategoryService } from "./course-category.service";
import { CreateCourseCategoryDto } from "./dto/create-course-category.dto";
import { UpdateCourseCategoryDto } from "./dto/update-course-category.dto";

// Catálogo editable de categorías de curso (núcleo, no solo Consultoría — ver
// docs/consultoria.md). Gestión ADMIN-only; el resto de roles solo lee (p. ej.
// para seleccionar una categoría al dar de alta una acción formativa).
@ApiTags("Categorías de curso")
@ApiBearerAuth()
@Controller("api/course-categories")
@UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER, Role.TUTOR, Role.CONSULTOR]))
export class CourseCategoryController {
  constructor(private readonly courseCategoryService: CourseCategoryService) {}

  @Post()
  @UseGuards(RoleGuard([Role.ADMIN]))
  @ApiOperation({ summary: "Crear una categoría de curso" })
  async create(@Body() dto: CreateCourseCategoryDto) {
    return this.courseCategoryService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "Listar categorías de curso" })
  async findAll() {
    return this.courseCategoryService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Ver una categoría de curso" })
  async findById(@Param("id", ParseIntPipe) id: number) {
    return this.courseCategoryService.findById(id);
  }

  @Patch(":id")
  @UseGuards(RoleGuard([Role.ADMIN]))
  @ApiOperation({ summary: "Editar una categoría de curso" })
  async update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateCourseCategoryDto) {
    return this.courseCategoryService.update(id, dto);
  }
}
