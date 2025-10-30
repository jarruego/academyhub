import { Inject, Injectable, Logger } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { eq, gte, lt } from "drizzle-orm";
import { import_jobs } from "src/database/schema";
import { 
    ImportJobInsertModel, 
    ImportJobUpdateModel, 
    ImportJobStatus, 
    ImportType 
} from "src/database/schema/tables/import.table";
import { ImportSummary } from "src/types/import/sage-import.types";

@Injectable()
export class JobService {
    private readonly logger = new Logger(JobService.name);

    constructor(
        @Inject(DATABASE_PROVIDER) 
        private readonly databaseService: DatabaseService,
    ) {}

    /**
     * Crea un nuevo trabajo de importación
     */
    async createJob(type: ImportType, additionalData?: Partial<ImportJobInsertModel>): Promise<string> {
        const jobId = this.generateJobId(type);
        
        const jobData: ImportJobInsertModel = {
            job_id: jobId,
            import_type: type,
            status: ImportJobStatus.PENDING,
            total_rows: 0,
            processed_rows: 0,
            ...additionalData
        };

        await this.databaseService.db
            .insert(import_jobs)
            .values(jobData);

        this.logger.log(`Trabajo creado: ${jobId} (${type})`);
        return jobId;
    }

    /**
     * Obtiene el estado de un trabajo
     */
    async getJobStatus(jobId: string) {
        const job = await this.databaseService.db
            .select()
            .from(import_jobs)
            .where(eq(import_jobs.job_id, jobId))
            .limit(1);

        return job[0] || null;
    }

    /**
     * Actualiza el estado de un trabajo
     */
    async updateJobStatus(jobId: string, status: ImportJobStatus, errorMessage?: string): Promise<void> {
        const updates: Partial<ImportJobUpdateModel> = {
            status,
            updated_at: new Date()
        };

        if (errorMessage) {
            updates.error_message = errorMessage;
        }

        if (status === ImportJobStatus.COMPLETED || status === ImportJobStatus.FAILED) {
            updates.completed_at = new Date();
        }

        await this.databaseService.db
            .update(import_jobs)
            .set(updates)
            .where(eq(import_jobs.job_id, jobId));

        this.logger.log(`Trabajo ${jobId} actualizado a estado: ${status}`);
    }

    /**
     * Actualiza el progreso de un trabajo
     */
    async updateJobProgress(jobId: string, totalRows?: number, processedRows?: number): Promise<void> {
        const updates: Partial<ImportJobUpdateModel> = {
            updated_at: new Date()
        };

        if (totalRows !== undefined) {
            updates.total_rows = totalRows;
        }

        if (processedRows !== undefined) {
            updates.processed_rows = processedRows;
        }

        await this.databaseService.db
            .update(import_jobs)
            .set(updates)
            .where(eq(import_jobs.job_id, jobId));
    }

    /**
     * Completa un trabajo con resumen final
     */
    async completeJob(jobId: string, summary: ImportSummary): Promise<void> {
        await this.databaseService.db
            .update(import_jobs)
            .set({
                status: ImportJobStatus.COMPLETED,
                result_summary: summary,
                completed_at: new Date(),
                updated_at: new Date()
            })
            .where(eq(import_jobs.job_id, jobId));

        this.logger.log(`Trabajo completado: ${jobId}`, summary);
    }

    /**
     * Marca un trabajo como fallido
     */
    async failJob(jobId: string, errorMessage: string): Promise<void> {
        await this.databaseService.db
            .update(import_jobs)
            .set({
                status: ImportJobStatus.FAILED,
                error_message: errorMessage.substring(0, 500), // Limitar longitud
                completed_at: new Date(),
                updated_at: new Date()
            })
            .where(eq(import_jobs.job_id, jobId));

        this.logger.error(`Trabajo fallido: ${jobId} - ${errorMessage}`);
    }

    /**
     * Cancela un trabajo en progreso
     */
    async cancelJob(jobId: string): Promise<boolean> {
        const job = await this.getJobStatus(jobId);
        
        if (!job) {
            return false;
        }

        if (job.status !== ImportJobStatus.PENDING && job.status !== ImportJobStatus.PROCESSING) {
            return false; // No se puede cancelar trabajos completados o fallidos
        }

        await this.updateJobStatus(jobId, ImportJobStatus.CANCELLED);
        return true;
    }

    /**
     * Obtiene trabajos en progreso
     */
    async getActiveJobs() {
        return await this.databaseService.db
            .select()
            .from(import_jobs)
            .where(
                eq(import_jobs.status, ImportJobStatus.PROCESSING)
            );
    }

    /**
     * Obtiene trabajos recientes (últimos 50)
     */
    async getRecentJobs(limit: number = 50) {
        return await this.databaseService.db
            .select()
            .from(import_jobs)
            .orderBy(import_jobs.created_at)
            .limit(limit);
    }

    /**
     * Limpia trabajos antiguos (más de X días)
     */
    async cleanupOldJobs(daysOld: number = 30): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        const result = await this.databaseService.db
            .delete(import_jobs)
            .where(
                lt(import_jobs.created_at, cutoffDate)
            )
            .returning({ id: import_jobs.id });

        this.logger.log(`Limpieza de trabajos antiguos: ${result.length} trabajos eliminados`);
        return result.length;
    }

    /**
     * Calcula progreso como porcentaje
     */
    calculateProgress(job: any): number {
        if (!job.total_rows || job.total_rows === 0) {
            return 0;
        }

        return Math.round((job.processed_rows / job.total_rows) * 100);
    }

    /**
     * Verifica si un trabajo está activo
     */
    isJobActive(status: ImportJobStatus): boolean {
        return status === ImportJobStatus.PENDING || status === ImportJobStatus.PROCESSING;
    }

    /**
     * Verifica si un trabajo está terminado
     */
    isJobFinished(status: ImportJobStatus): boolean {
        return status === ImportJobStatus.COMPLETED || 
               status === ImportJobStatus.FAILED || 
               status === ImportJobStatus.CANCELLED;
    }

    /**
     * Genera un ID único para el trabajo
     */
    private generateJobId(type: ImportType): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const random = Math.random().toString(36).substr(2, 9);
        return `${type}_${timestamp}_${random}`;
    }

    /**
     * Recupera trabajos interrumpidos para reanudar
     */
    async recoverInterruptedJobs() {
        const interruptedJobs = await this.databaseService.db
            .select()
            .from(import_jobs)
            .where(eq(import_jobs.status, ImportJobStatus.PROCESSING));

        for (const job of interruptedJobs) {
            await this.updateJobStatus(
                job.job_id, 
                ImportJobStatus.FAILED, 
                'Trabajo interrumpido - servidor reiniciado'
            );
        }

        this.logger.log(`Recuperados ${interruptedJobs.length} trabajos interrumpidos`);
        return interruptedJobs.length;
    }
}