import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth, ApiResponse } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional } from "class-validator";
import { Transform } from "class-transformer";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { InaemImportService } from "./inaem-import.service";
import { JobService } from "../import-sage/job.service";

const toBoolean = ({ value }: { value: unknown }) => value === true || value === "true";

class UploadInaemDto {
  // Crear acciones formativas inexistentes (curso provisional). Por defecto: true.
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  createMissingCourses?: boolean;
}

class ResolveConflictDto {
  @IsIn(["overwrite", "keep"])
  action: "overwrite" | "keep";
}

type MulterFile = { originalname: string; buffer: Buffer };

@ApiTags("Import INAEM")
@ApiBearerAuth()
@Controller("api/import-inaem")
@UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
export class InaemImportController {
  constructor(
    private readonly inaemImportService: InaemImportService,
    private readonly jobService: JobService,
  ) {}

  /**
   * Sube hasta tres ficheros del INAEM (todos opcionales). Si se envían varios,
   * se procesan en orden: Acciones -> Preinscripciones -> Alumnos.
   */
  @Post("upload")
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
  ) {
    const payload = {
      acciones: files?.acciones?.[0]?.buffer,
      alumnos: files?.alumnos?.[0]?.buffer,
      preinscripciones: files?.preinscripciones?.[0]?.buffer,
    };
    if (!payload.acciones && !payload.alumnos && !payload.preinscripciones) {
      throw new HttpException("No se ha proporcionado ningún fichero", HttpStatus.BAD_REQUEST);
    }
    const jobId = await this.inaemImportService.startImport(payload, {
      createMissingCourses: body?.createMissingCourses !== false, // default true
    });
    return { jobId, message: "Importación INAEM iniciada" };
  }

  @Get("job-status/:jobId")
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
  @ApiOperation({ summary: "Preinscripciones de un usuario (ficha de usuario)" })
  async getUserPreinscriptions(@Param("id") id: string) {
    const num = parseInt(id, 10);
    if (Number.isNaN(num)) throw new HttpException("ID inválido", HttpStatus.BAD_REQUEST);
    return this.inaemImportService.getUserPreinscriptions(num);
  }

  @Get("preinscriptions/by-course/:id")
  @ApiOperation({ summary: "Preinscritos de un curso/expediente" })
  async getCoursePreinscriptions(@Param("id") id: string) {
    const num = parseInt(id, 10);
    if (Number.isNaN(num)) throw new HttpException("ID inválido", HttpStatus.BAD_REQUEST);
    return this.inaemImportService.getCoursePreinscriptions(num);
  }

  @Get("conflicts")
  @ApiOperation({ summary: "Conflictos de sobrescritura pendientes (usuario ya existente)" })
  async getConflicts() {
    return this.inaemImportService.getPendingConflicts();
  }

  @Put("conflicts/:id/resolve")
  @ApiOperation({ summary: "Resolver un conflicto: overwrite (sobrescribir) o keep (mantener)" })
  async resolveConflict(@Param("id") id: string, @Body() body: ResolveConflictDto) {
    const num = parseInt(id, 10);
    if (Number.isNaN(num)) throw new HttpException("ID inválido", HttpStatus.BAD_REQUEST);
    await this.inaemImportService.resolveConflict(num, body.action);
    return { message: "Conflicto resuelto", id: num, action: body.action };
  }

  @Delete("conflicts")
  @ApiOperation({ summary: "Borrar todos los conflictos INAEM pendientes" })
  async deleteAllConflicts() {
    const deleted = await this.inaemImportService.deleteAllPendingConflicts();
    return { message: "Conflictos borrados", deleted };
  }

  @Delete("conflicts/:id")
  @ApiOperation({ summary: "Borrar (descartar) un conflicto INAEM pendiente sin tocar el usuario" })
  async deleteConflict(@Param("id") id: string) {
    const num = parseInt(id, 10);
    if (Number.isNaN(num)) throw new HttpException("ID inválido", HttpStatus.BAD_REQUEST);
    await this.inaemImportService.deleteConflict(num);
    return { message: "Conflicto borrado", id: num };
  }
}
