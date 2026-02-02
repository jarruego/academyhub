import { Injectable, Logger } from '@nestjs/common';
import { ScheduledTask } from '../interfaces/scheduled-task.interface';
import { ImportService } from '../../api/import-sage/import.service';
import { DistributedLock } from '../utils/distributed-lock';

@Injectable()
export class SageImportTask implements ScheduledTask {
    private readonly logger = new Logger(SageImportTask.name);

    name = 'sage-import';
    description = 'Importación automática de usuarios SAGE desde SFTP';
    private readonly lockKey = 'sage-import-lock';

    constructor(
        private readonly importService: ImportService,
        private readonly distributedLock: DistributedLock
    ) {}

    get enabled(): boolean {
        return (process.env.SAGE_IMPORT_ENABLED || 'true').toLowerCase() === 'true';
    }

    get cronExpression(): string {
        // Por defecto 2:00 AM todos los días (0 2 * * *)
        return process.env.SAGE_IMPORT_CRON || '0 2 * * *';
    }

    get runOnStartup(): boolean {
        return false; // Las importaciones programadas nunca se ejecutan al arrancar
    }

    async execute(): Promise<void> {
        // Intentar adquirir lock (timeout de 3 horas máximo)
        const lockAcquired = await this.distributedLock.acquire(this.lockKey, 10800);

        if (!lockAcquired) {
            this.logger.log(
                '⏭️  Tarea saltada: otra instancia ya está ejecutando la importación'
            );
            return;
        }

        try {
            this.logger.log('📥 Descargando e importando CSV SAGE desde SFTP...');
            
            const jobId = await this.importService.startImportJobFromFtp();
            
            this.logger.log(`✅ Importación SAGE iniciada - Job ID: ${jobId}`);
        } finally {
            // Liberar lock siempre, incluso si hay error
            await this.distributedLock.release(this.lockKey);
        }
    }
}
