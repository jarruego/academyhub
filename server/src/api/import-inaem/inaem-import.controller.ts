import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  HttpException,
  HttpStatus,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth, ApiResponse } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsOptional } from "class-validator";
import { Transform, Type } from "class-transformer";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { InaemImportService } from "./inaem-import.service";
import { JobService } from "../import-sage/job.service";
import { JwtPayload } from "src/auth/auth.service";

const toBoolean = ({ value }: { value: unknown }) => value === true || value === "true";

class UploadInaemDto {
  // Crear acciones formativas inexistentes (curso provisional). Por defecto: true.
  // Ignorado (forzado a false) cuando el actor solo tiene el permiso puntual
  // can_import_inaem — ver InaemImportController.upload.
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  createMissingCourses?: boolean;

  // Obligatorio solo para quien accede vía can_import_inaem (no ADMIN/MANAGER):
  // acota el import de Preinscripciones al expediente de esta edición.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_course?: number;
}

class ResolveConflictDto {
  @IsIn(["overwrite", "keep"])
  action: "overwrite" | "keep";
}

type MulterFile = { originalname: string; buffer: Buffer };

@ApiTags("Import INAEM")
@ApiBearerAuth()
@Controller("api/import-inaem")
export class InaemImportController {
  constructor(
    private readonly inaemImportService: InaemImportService,
    private readonly jobService: JobService,
  ) {}

  /**
   * Sube hasta tres ficheros del INAEM (todos opcionales). Si se envían varios,
   * se procesan en orden: Acciones -> Preinscripciones -> Alumnos.
   *
   * Guard ampliado a propósito respecto al resto del controlador (que sigue
   * ADMIN/MANAGER): quien no sea ADMIN/MANAGER solo puede pasar si tiene el
   * permiso puntual `can_import_inaem` (auth_users.can_import_inaem), y en ese
   * caso queda restringido aquí mismo, en el handler (no en el guard, que no
   * puede ver los ficheros subidos — los rellena el interceptor después):
   * nunca puede enviar Acciones/Alumnos, y su fichero de Preinscripciones se
   * acota al Nº de Expediente de `id_course` (obligatorio en ese caso),
   * forzando además `createMissingCourses: false`. Ver docs/import-inaem.md.
   */
  @Post("upload")
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER, Role.TUTOR]))
  @ApiOperation({ summary: "Importar ficheros del INAEM (acciones/alumnos/preinscripciones)" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 201, description: "Importación iniciada" })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "acciones", maxCount: 1 },
        { name: "alumnos", maxCount: 1 },
        { name: "preinscripciones", maxCount: 1 },
      ],
      { limits: { fileSize: 50 * 1024 * 1024 } },
    ),
  )
  async upload(
    @UploadedFiles()
    files: { acciones?: MulterFile[]; alumnos?: MulterFile[]; preinscripciones?: MulterFile[] },
    @Body() body: UploadInaemDto,
    @Req() req: { user: JwtPayload },
  ) {
    const payload = {
      acciones: files?.acciones?.[0]?.buffer,
      alumnos: files?.alumnos?.[0]?.buffer,
      preinscripciones: files?.preinscripciones?.[0]?.buffer,
    };
    if (!payload.acciones && !payload.alumnos && !payload.preinscripciones) {
      throw new HttpException("No se ha proporcionado ningún fichero", HttpStatus.BAD_REQUEST);
    }

    const hasFullAccess = req.user.role === Role.ADMIN || req.user.role === Role.MANAGER;
    let restrictToFileNumber: string | undefined;

    if (!hasFullAccess) {
      if (payload.acciones || payload.alumnos) {
        throw new ForbiddenException("Solo ADMIN/MANAGER pueden importar Acciones o Alumnos.");
      }
      if (!req.user.can_import_inaem) {
        throw new ForbiddenException("No tienes permiso para importar Preinscripciones INAEM.");
      }
      if (!body.id_course) {
        throw new BadRequestException("Falta id_course (obligatorio para este permiso).");
      }
      const fileNumber = await this.inaemImportService.getCourseFileNumber(body.id_course);
      if (!fileNumber) {
        throw new BadRequestException("La edición indicada no tiene Nº de Expediente asignado; no se puede acotar el import.");
      }
      restrictToFileNumber = fileNumber;
    }

    const jobId = await this.inaemImportService.startImport(payload, {
      createMissingCourses: hasFullAccess ? body?.createMissingCourses !== false : false, // default true solo con acceso completo
      restrictToFileNumber,
    });
    return { jobId, message: "Importación INAEM iniciada" };
  }

  // Mismo guard ampliado que "upload": quien lanza un import de Preinscripciones
  // vía el permiso puntual también necesita poder consultar su progreso.
  @Get("job-status/:jobId")
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER, Role.TUTOR]))
  @ApiOperation({ summary: "Estado de un trabajo de importación INAEM" })
  async getJobStatus(@Param("jobId") jobId: string) {
    const job = await this.jobService.getJobStatus(jobId);
    if (!job) throw new HttpException("Trabajo no encontrado", HttpStatus.NOT_FOUND);
    return {
      jobId: job.job_id,
      status: job.status,
      progress: this.jobService.calculateProgress(job),
      totalRows: job.total_rows || 0,
      processedRows: job.processed_rows || 0,
      errorMessage: job.error_message || undefined,
      completedAt: job.completed_at || undefined,
      resultSummary: job.result_summary || undefined,
    };
  }

  @Get("preinscriptions/by-user/:id")
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  @ApiOperation({ summary: "Preinscripciones de un usuario (ficha de usuario)" })
  async getUserPreinscriptions(@Param("id") id: string) {
    const num = parseInt(id, 10);
    if (Number.isNaN(num)) throw new HttpException("ID inválido", HttpStatus.BAD_REQUEST);
    return this.inaemImportService.getUserPreinscriptions(num);
  }

  @Get("preinscriptions/by-course/:id")
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  @ApiOperation({ summary: "Preinscritos de un curso/expediente" })
  async getCoursePreinscriptions(@Param("id") id: string) {
    const num = parseInt(id, 10);
    if (Number.isNaN(num)) throw new HttpException("ID inválido", HttpStatus.BAD_REQUEST);
    return this.inaemImportService.getCoursePreinscriptions(num);
  }

  @Get("preinscriptions/by-course/:id/enrolled-count")
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  @ApiOperation({ summary: "Nº de usuarios matriculados en algún grupo del curso" })
  async getCourseEnrolledCount(@Param("id") id: string) {
    const num = parseInt(id, 10);
    if (Number.isNaN(num)) throw new HttpException("ID inválido", HttpStatus.BAD_REQUEST);
    return { count: await this.inaemImportService.getCourseEnrolledCount(num) };
  }

  @Delete("preinscriptions/by-course/:id")
  @UseGuards(RoleGuard([Role.ADMIN]))
  @ApiOperation({ summary: "Borra todas las preinscripciones de un curso (solo ADMIN, solo si no hay matriculados)" })
  async deleteCoursePreinscriptions(@Param("id") id: string) {
    const num = parseInt(id, 10);
    if (Number.isNaN(num)) throw new HttpException("ID inválido", HttpStatus.BAD_REQUEST);
    return this.inaemImportService.deleteCoursePreinscriptions(num);
  }

  @Get("conflicts")
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  @ApiOperation({ summary: "Conflictos de sobrescritura pendientes (usuario ya existente)" })
  async getConflicts() {
    return this.inaemImportService.getPendingConflicts();
  }

  @Put("conflicts/:id/resolve")
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  @ApiOperation({ summary: "Resolver un conflicto: overwrite (sobrescribir) o keep (mantener)" })
  async resolveConflict(@Param("id") id: string, @Body() body: ResolveConflictDto) {
    const num = parseInt(id, 10);
    if (Number.isNaN(num)) throw new HttpException("ID inválido", HttpStatus.BAD_REQUEST);
    await this.inaemImportService.resolveConflict(num, body.action);
    return { message: "Conflicto resuelto", id: num, action: body.action };
  }

  @Delete("conflicts")
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  @ApiOperation({ summary: "Borrar todos los conflictos INAEM pendientes" })
  async deleteAllConflicts() {
    const deleted = await this.inaemImportService.deleteAllPendingConflicts();
    return { message: "Conflictos borrados", deleted };
  }

  @Delete("conflicts/:id")
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  @ApiOperation({ summary: "Borrar (descartar) un conflicto INAEM pendiente sin tocar el usuario" })
  async deleteConflict(@Param("id") id: string) {
    const num = parseInt(id, 10);
    if (Number.isNaN(num)) throw new HttpException("ID inválido", HttpStatus.BAD_REQUEST);
    await this.inaemImportService.deleteConflict(num);
    return { message: "Conflicto borrado", id: num };
  }
}
