import {
    Controller,
    Post,
    Get,
    Put,
    Param,
    Body,
    UploadedFile,
    UseInterceptors,
    UseGuards,
    HttpStatus,
    HttpException,
    Query
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiOperation, ApiConsumes, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsNumber } from "class-validator";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { ImportService } from "./import.service";
import { JobService } from "./job.service";
import { DecisionAction } from "src/database/schema/tables/import.table";

// DTOs
class UploadCSVResponseDto {
    jobId: string;
    message: string;
}

class JobStatusResponseDto {
    jobId: string;
    status: string;
    progress: number;
    totalRows: number;
    processedRows: number;
    errorMessage?: string;
    completedAt?: Date;
    resultSummary?: any;
}

class PendingDecisionDto {
    id: number;
    dniCsv: string;
    nameCSV: string;
    firstSurnameCSV: string;
    secondSurnameCSV?: string;
    nameDb: string;
    firstSurnameDb: string;
    secondSurnameDb?: string;
    similarityScore: number;
    csvRowData: any;
}

class ProcessDecisionDto {
    @IsEnum(DecisionAction, { message: 'Action must be one of: link, create_new, skip' })
    action: DecisionAction;
    
    @IsOptional()
    @IsNumber({}, { message: 'Selected user ID must be a number' })
    selectedUserId?: number;
    
    @IsOptional()
    notes?: string;
}

class ProcessedDecisionDto {
    id: number;
    importSource: string;
    dniCsv: string;
    nameCSV: string;
    firstSurnameCSV: string;
    secondSurnameCSV?: string;
    nameDb?: string;
    firstSurnameDb?: string;
    secondSurnameDb?: string;
    similarityScore?: number;
    csvRowData: any;
    selectedUserId?: number;
    decisionAction: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

class RevertDecisionDto {
    @IsOptional()
    reason?: string;
}

@ApiTags('Import')
@ApiBearerAuth()
@Controller('api/import')
@UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
export class ImportController {
    constructor(
        private readonly importService: ImportService,
        private readonly jobService: JobService
    ) {}

    /**
     * Subir archivo CSV para importación
     */
    @Post('upload-csv')
    @ApiOperation({ summary: 'Subir archivo CSV para importación de usuarios SAGE' })
    @ApiConsumes('multipart/form-data')
    @ApiResponse({ 
        status: 201, 
        description: 'Archivo subido exitosamente. Importación iniciada.',
        type: UploadCSVResponseDto
    })
    @ApiResponse({ status: 400, description: 'Archivo inválido o error en el formato' })
    @ApiResponse({ status: 403, description: 'Sin permisos para realizar importaciones' })
    @UseInterceptors(FileInterceptor('file', {
        fileFilter: (req, file, cb) => {
            if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
                cb(null, true);
            } else {
                cb(new HttpException('Solo se permiten archivos CSV', HttpStatus.BAD_REQUEST), false);
            }
        },
        limits: {
            fileSize: 50 * 1024 * 1024 // 50MB máximo
        }
    }))
    async uploadCSV(@UploadedFile() file: Express.Multer.File): Promise<UploadCSVResponseDto> {
        if (!file) {
            throw new HttpException('No se ha proporcionado ningún archivo', HttpStatus.BAD_REQUEST);
        }

        try {
            const jobId = await this.importService.startImportJob(file.buffer, file.originalname);
            
            return {
                jobId,
                message: 'Importación iniciada exitosamente'
            };
        } catch (error: any) {
            throw new HttpException(
                `Error iniciando importación: ${error?.message || error}`, 
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Obtener estado de un trabajo de importación
     */
    @Get('job-status/:jobId')
    @ApiOperation({ summary: 'Obtener estado de trabajo de importación' })
    @ApiResponse({ 
        status: 200, 
        description: 'Estado del trabajo obtenido exitosamente',
        type: JobStatusResponseDto
    })
    @ApiResponse({ status: 404, description: 'Trabajo no encontrado' })
    async getJobStatus(@Param('jobId') jobId: string): Promise<JobStatusResponseDto> {
        const job = await this.jobService.getJobStatus(jobId);
        
        if (!job) {
            throw new HttpException('Trabajo no encontrado', HttpStatus.NOT_FOUND);
        }

        return {
            jobId: job.job_id,
            status: job.status,
            progress: this.jobService.calculateProgress(job),
            totalRows: job.total_rows || 0,
            processedRows: job.processed_rows || 0,
            errorMessage: job.error_message || undefined,
            completedAt: job.completed_at || undefined,
            resultSummary: job.result_summary || undefined
        };
    }

    /**
     * Obtener resumen de importación completada
     */
    @Get('summary/:jobId')
    @ApiOperation({ summary: 'Obtener resumen de importación completada' })
    @ApiResponse({ status: 200, description: 'Resumen obtenido exitosamente' })
    @ApiResponse({ status: 404, description: 'Trabajo no encontrado o no completado' })
    async getImportSummary(@Param('jobId') jobId: string) {
        const job = await this.jobService.getJobStatus(jobId);
        
        if (!job) {
            throw new HttpException('Trabajo no encontrado', HttpStatus.NOT_FOUND);
        }

        if (job.status !== 'completed') {
            throw new HttpException(
                'El trabajo no está completado', 
                HttpStatus.BAD_REQUEST
            );
        }

        return {
            jobId: job.job_id,
            status: job.status,
            summary: job.result_summary,
            completedAt: job.completed_at,
            processingTime: job.completed_at && job.created_at 
                ? job.completed_at.getTime() - job.created_at.getTime()
                : null
        };
    }

    /**
     * Listar trabajos recientes
     */
    @Get('jobs')
    @ApiOperation({ summary: 'Listar trabajos de importación recientes' })
    @ApiResponse({ status: 200, description: 'Lista de trabajos obtenida exitosamente' })
    async getRecentJobs(@Query('limit') limit?: string) {
        const limitNum = limit ? parseInt(limit) : 50;
        const jobs = await this.jobService.getRecentJobs(limitNum);
        
        return jobs.map(job => ({
            jobId: job.job_id,
            type: job.import_type,
            status: job.status,
            progress: this.jobService.calculateProgress(job),
            totalRows: job.total_rows || 0,
            processedRows: job.processed_rows || 0,
            createdAt: job.created_at,
            completedAt: job.completed_at,
            errorMessage: job.error_message
        }));
    }

    /**
     * Obtener trabajos activos
     */
    @Get('active-jobs')
    @ApiOperation({ summary: 'Obtener trabajos en progreso' })
    @ApiResponse({ status: 200, description: 'Trabajos activos obtenidos exitosamente' })
    async getActiveJobs() {
        const jobs = await this.jobService.getActiveJobs();
        
        return jobs.map(job => ({
            jobId: job.job_id,
            type: job.import_type,
            status: job.status,
            progress: this.jobService.calculateProgress(job),
            totalRows: job.total_rows || 0,
            processedRows: job.processed_rows || 0,
            createdAt: job.created_at
        }));
    }

    /**
     * Cancelar trabajo en progreso
     */
    @Put('cancel/:jobId')
    @ApiOperation({ summary: 'Cancelar trabajo de importación' })
    @ApiResponse({ status: 200, description: 'Trabajo cancelado exitosamente' })
    @ApiResponse({ status: 400, description: 'No se puede cancelar el trabajo' })
    @ApiResponse({ status: 404, description: 'Trabajo no encontrado' })
    async cancelJob(@Param('jobId') jobId: string) {
        const success = await this.jobService.cancelJob(jobId);
        
        if (!success) {
            throw new HttpException(
                'No se puede cancelar el trabajo. Puede que ya esté completado o no exista.',
                HttpStatus.BAD_REQUEST
            );
        }

        return {
            message: 'Trabajo cancelado exitosamente',
            jobId
        };
    }

    /**
     * Obtener decisiones pendientes
     */
    @Get('pending-decisions')
    @ApiOperation({ summary: 'Obtener decisiones de importación pendientes' })
    @ApiResponse({ 
        status: 200, 
        description: 'Decisiones pendientes obtenidas exitosamente',
        type: [PendingDecisionDto]
    })
    async getPendingDecisions(@Query('source') source?: string): Promise<PendingDecisionDto[]> {
        const decisions = await this.importService.getPendingDecisions(source);
        
        return decisions.map(decision => ({
            id: decision.id,
            dniCsv: decision.dniCsv || '',
            nameCSV: decision.nameCSV || '',
            firstSurnameCSV: decision.firstSurnameCSV || '',
            secondSurnameCSV: decision.secondSurnameCSV || undefined,
            nameDb: decision.nameDb || '',
            firstSurnameDb: decision.firstSurnameDb || '',
            secondSurnameDb: decision.secondSurnameDb || undefined,
            similarityScore: parseFloat(decision.similarityScore?.toString() || '0'),
            csvRowData: decision.csvRowData
        }));
    }

    /**
     * Procesar decisión manual
     */
    @Put('process-decision/:decisionId')
    @ApiOperation({ summary: 'Procesar decisión de importación manual' })
    @ApiResponse({ status: 200, description: 'Decisión procesada exitosamente' })
    @ApiResponse({ status: 404, description: 'Decisión no encontrada' })
    async processDecision(
        @Param('decisionId') decisionId: string,
        @Body() processDecisionDto: ProcessDecisionDto
    ) {
        const id = parseInt(decisionId);
        
        if (isNaN(id)) {
            throw new HttpException('ID de decisión inválido', HttpStatus.BAD_REQUEST);
        }

        try {
            await this.importService.processDecision(
                id,
                processDecisionDto.action,
                processDecisionDto.selectedUserId
            );

            return {
                message: 'Decisión procesada exitosamente',
                decisionId: id,
                action: processDecisionDto.action
            };
        } catch (error: any) {
            throw new HttpException(
                `Error procesando decisión: ${error?.message || error}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Obtener decisiones procesadas
     */
    @Get('processed-decisions')
    @ApiOperation({ summary: 'Obtener decisiones de importación procesadas' })
    @ApiResponse({ 
        status: 200, 
        description: 'Decisiones procesadas obtenidas exitosamente',
        type: [ProcessedDecisionDto]
    })
    async getProcessedDecisions(
        @Query('action') action?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('search') search?: string
    ): Promise<ProcessedDecisionDto[]> {
        try {
            const filters = {
                action,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                search
            };

            const decisions = await this.importService.getProcessedDecisions(filters);

            return decisions.map(decision => ({
                id: decision.id,
                importSource: decision.import_source,
                dniCsv: decision.dni_csv || '',
                nameCSV: decision.name_csv || '',
                firstSurnameCSV: decision.first_surname_csv || '',
                secondSurnameCSV: decision.second_surname_csv || undefined,
                nameDb: decision.name_db || undefined,
                firstSurnameDb: decision.first_surname_db || undefined,
                secondSurnameDb: decision.second_surname_db || undefined,
                similarityScore: decision.similarity_score ? parseFloat(decision.similarity_score.toString()) : undefined,
                csvRowData: decision.csv_row_data,
                selectedUserId: decision.selected_user_id || undefined,
                decisionAction: decision.decision_action || '',
                notes: decision.notes || undefined,
                createdAt: decision.created_at,
                updatedAt: decision.updated_at
            }));
        } catch (error: any) {
            throw new HttpException(
                `Error obteniendo decisiones procesadas: ${error?.message || error}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Revertir decisión procesada
     */
    @Put('revert-decision/:decisionId')
    @ApiOperation({ summary: 'Revertir decisión procesada a pendiente' })
    @ApiResponse({ status: 200, description: 'Decisión revertida exitosamente' })
    @ApiResponse({ status: 404, description: 'Decisión no encontrada' })
    @ApiResponse({ status: 400, description: 'La decisión no puede ser revertida' })
    async revertDecision(
        @Param('decisionId') decisionId: string,
        @Body() revertDecisionDto: RevertDecisionDto
    ) {
        const id = parseInt(decisionId);
        
        if (isNaN(id)) {
            throw new HttpException('ID de decisión inválido', HttpStatus.BAD_REQUEST);
        }

        try {
            await this.importService.revertDecision(id, revertDecisionDto.reason);

            return {
                message: 'Decisión revertida exitosamente',
                decisionId: id
            };
        } catch (error: any) {
            throw new HttpException(
                `Error revirtiendo decisión: ${error?.message || error}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Limpiar trabajos antiguos
     */
    @Post('cleanup')
    @ApiOperation({ summary: 'Limpiar trabajos de importación antiguos' })
    @ApiResponse({ status: 200, description: 'Limpieza completada exitosamente' })
    @UseGuards(RoleGuard([Role.ADMIN])) // Solo administradores
    async cleanupOldJobs(@Query('days') days?: string) {
        const daysNum = days ? parseInt(days) : 30;
        const deletedCount = await this.jobService.cleanupOldJobs(daysNum);
        
        return {
            message: 'Limpieza completada exitosamente',
            deletedJobs: deletedCount,
            daysOld: daysNum
        };
    }

    /**
     * Recuperar trabajos interrumpidos
     */
    @Post('recover-interrupted')
    @ApiOperation({ summary: 'Recuperar trabajos interrumpidos por reinicio del servidor' })
    @ApiResponse({ status: 200, description: 'Trabajos recuperados exitosamente' })
    @UseGuards(RoleGuard([Role.ADMIN])) // Solo administradores
    async recoverInterruptedJobs() {
        const recoveredCount = await this.jobService.recoverInterruptedJobs();
        
        return {
            message: 'Trabajos interrumpidos recuperados exitosamente',
            recoveredJobs: recoveredCount
        };
    }

    @Get('failed-users')
    @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Obtener usuarios que fallaron al importarse' })
    @ApiResponse({
        status: 200,
        description: 'Lista de usuarios fallidos obtenida exitosamente'
    })
    async getFailedUsers(
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '50'
    ) {
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 50;
        
        return await this.importService.getFailedUsers(pageNum, limitNum);
    }

    @Get('failed-users/stats')
    @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Obtener estadísticas de usuarios fallidos' })
    @ApiResponse({
        status: 200,
        description: 'Estadísticas de usuarios fallidos obtenidas exitosamente'
    })
    async getFailedUsersStats() {
        return await this.importService.getFailedUsersStats();
    }
}