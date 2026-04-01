import { Inject, Injectable, Logger } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { desc, eq, gte, lt, sql } from "drizzle-orm";
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

        // Retención: conservar solo los 100 jobs más recientes
        await this.keepOnlyLatestJobs(100);

        this.logger.log(`Trabajo creado: ${jobId} (${type})`);
        return jobId;
    }

    /**
     * Elimina jobs antiguos para conservar solo los N más recientes.
     */
    private async keepOnlyLatestJobs(maxJobs: number): Promise<void> {
        await this.databaseService.db.execute(sql`
            DELETE FROM import_jobs
            WHERE id IN (
                SELECT id
                FROM import_jobs
                ORDER BY created_at DESC, id DESC
                OFFSET ${maxJobs}
            )
        `);
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
            .select({
                job_id: import_jobs.job_id,
                import_type: import_jobs.import_type,
                status: import_jobs.status,
                total_rows: import_jobs.total_rows,
                processed_rows: import_jobs.processed_rows,
                created_at: import_jobs.created_at,
                completed_at: import_jobs.completed_at,
                error_message: import_jobs.error_message,
            })
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
            .select({
                job_id: import_jobs.job_id,
                import_type: import_jobs.import_type,
                status: import_jobs.status,
                total_rows: import_jobs.total_rows,
                processed_rows: import_jobs.processed_rows,
                created_at: import_jobs.created_at,
                completed_at: import_jobs.completed_at,
                error_message: import_jobs.error_message,
            })
            .from(import_jobs)
            .orderBy(desc(import_jobs.created_at))
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
     * ===== CLEANUP AUTOMÁTICO POST-DEPLOY =====
     * Recupera trabajos interrumpidos en PROCESSING (huérfanos después de deploy)
     * Se ejecuta automáticamente al iniciar la app via OnModuleInit
     */
    async cleanupOrphanedJobs(): Promise<number> {
        const orphanedJobs = await this.databaseService.db
            .select()
            .from(import_jobs)
            .where(eq(import_jobs.status, ImportJobStatus.PROCESSING));

        if (orphanedJobs.length === 0) {
            this.logger.debug('✅ No hay trabajos huérfanos en PROCESSING');
            return 0;
        }

        this.logger.warn(`⚠️ Encontrados ${orphanedJobs.length} trabajos en PROCESSING (huérfanos post-deploy)`);

        for (const job of orphanedJobs) {
            try {
                const completedAt = new Date();
                const errorMessage = `❌ CANCELADO AUTOMÁTICAMENTE: Trabajo interrumpido durante deploy. Reanuda la importación para continuar.`;
                
                await this.databaseService.db
                    .update(import_jobs)
                    .set({
                        status: ImportJobStatus.CANCELLED,
                        error_message: errorMessage,
                        completed_at: completedAt
                    })
                    .where(eq(import_jobs.job_id, job.job_id));

                this.logger.warn(`🔄 Cancelado trabajo huérfano: ${job.job_id}`);
            } catch (error) {
                this.logger.error(`Error cancelando trabajo huérfano ${job.job_id}:`, error);
            }
        }

        this.logger.log(`✅ Cleanup completado: ${orphanedJobs.length} trabajos cancelados`);
        return orphanedJobs.length;
    }

    /**
     * Alias para compatibilidad - llamado desde recoverInterruptedJobs
     */
    async recoverInterruptedJobs() {
        return await this.cleanupOrphanedJobs();
    }
}