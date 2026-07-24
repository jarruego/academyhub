import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { JwtPayload } from "src/auth/auth.service";
import { CourseRequestService } from "./course-request.service";
import { CourseRequestPdfService } from "./course-request-pdf.service";
import { CreateCourseRequestDto } from "./dto/create-course-request.dto";
import { UpdateCourseRequestDto } from "./dto/update-course-request.dto";
import { SaveCourseRequestStudentsDto } from "./dto/save-course-request-students.dto";
import { FilterCourseRequestDto } from "./dto/filter-course-request.dto";
import { CourseRequestReportFilterDto } from "./dto/course-request-report-filter.dto";

type MulterFile = { originalname: string; buffer: Buffer };

function parseId(id: string): number {
  const numericId = parseInt(id, 10);
  if (Number.isNaN(numericId)) throw new HttpException("ID inválido", HttpStatus.BAD_REQUEST);
  return numericId;
}

// ADMIN/MANAGER: acceso total. VIEWER: solo lectura (los endpoints de escritura
// llevan además su propio RoleGuard([ADMIN, MANAGER]) que se suma a este).
@ApiTags("Peticiones de centros")
@ApiBearerAuth()
@Controller("api/course-requests")
@UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER]))
export class CourseRequestController {
  constructor(
    private readonly courseRequestService: CourseRequestService,
    private readonly courseRequestPdfService: CourseRequestPdfService,
  ) {}

  @Post()
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  @ApiOperation({ summary: "Crear una petición (cabecera: centro, curso, contacto, notas)" })
  async create(@Body() dto: CreateCourseRequestDto, @Req() req: { user: JwtPayload }) {
    return this.courseRequestService.create(dto, req.user?.id);
  }

  @Get()
  @ApiOperation({ summary: "Listar peticiones (filtrable por curso/centro/empresa/estado)" })
  async findAll(@Query() filters: FilterCourseRequestDto) {
    return this.courseRequestService.findAll(filters);
  }

  @Get("report")
  @ApiOperation({ summary: "Informe: cursos pedidos por empresa, con alumnos por centro (filtrable)" })
  async report(@Query() filters: CourseRequestReportFilterDto) {
    return this.courseRequestService.report(filters);
  }

  @Get("report/pdf")
  @ApiOperation({ summary: "Informe en PDF: cursos pedidos por empresa, con alumnos por centro" })
  async reportPdf(@Query() filters: CourseRequestReportFilterDto, @Res() res: Response) {
    const rows = await this.courseRequestService.report(filters);
    this.courseRequestPdfService.streamReportPdf(rows, res);
  }

  @Get(":id")
  @ApiOperation({ summary: "Detalle de una petición con sus alumnos" })
  async findOne(@Param("id") id: string) {
    return this.courseRequestService.findById(parseId(id));
  }

  @Put(":id")
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  @ApiOperation({ summary: "Editar la cabecera de una petición" })
  async update(@Param("id") id: string, @Body() dto: UpdateCourseRequestDto) {
    return this.courseRequestService.update(parseId(id), dto);
  }

  @Put(":id/students")
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  @ApiOperation({ summary: "Guardar (sustituir) las filas de alumnos de la petición" })
  async saveStudents(@Param("id") id: string, @Body() dto: SaveCourseRequestStudentsDto) {
    return this.courseRequestService.saveStudents(parseId(id), dto.students);
  }

  @Post(":id/upload")
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  @ApiOperation({ summary: "Subir Excel de alumnos y añadirlos a la petición" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  async upload(@Param("id") id: string, @UploadedFile() file: MulterFile) {
    if (!file?.buffer) throw new HttpException("No se ha proporcionado ningún fichero", HttpStatus.BAD_REQUEST);
    return this.courseRequestService.uploadExcel(parseId(id), file.buffer);
  }

  @Put(":id/close")
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  @ApiOperation({ summary: "Cerrar manualmente una petición" })
  async close(@Param("id") id: string) {
    return this.courseRequestService.close(parseId(id));
  }

  @Put(":id/reopen")
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  @ApiOperation({ summary: "Reabrir una petición cerrada" })
  async reopen(@Param("id") id: string) {
    return this.courseRequestService.reopen(parseId(id));
  }

  @Delete(":id")
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  @ApiOperation({ summary: "Eliminar una petición (y sus filas de alumnos)" })
  async remove(@Param("id") id: string) {
    return this.courseRequestService.remove(parseId(id));
  }
}
