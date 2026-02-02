import { Module, OnModuleInit, Inject } from "@nestjs/common";
import { DatabaseModule } from "src/database/database.module";
import { ImportController } from "./import.controller";
import { ImportService } from "./import.service";
import { JobService } from "./job.service";

@Module({
    imports: [DatabaseModule],
    controllers: [ImportController],
    providers: [ImportService, JobService],
    exports: [ImportService, JobService]
})
export class ImportModule implements OnModuleInit {
    constructor(@Inject(JobService) private readonly jobService: JobService) {}

    /**
     * ===== CLEANUP AUTOMÁTICO POST-DEPLOY =====
     * Ejecuta al iniciar la app para limpiar trabajos en PROCESSING huérfanos
     */
    async onModuleInit() {
        try {
            await this.jobService.cleanupOrphanedJobs();
        } catch (error) {
            console.error('Error en cleanup de trabajos huérfanos:', error);
            // No bloquear la inicialización de la app si falla el cleanup
        }
    }
}