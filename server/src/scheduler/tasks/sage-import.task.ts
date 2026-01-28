import { Injectable, Logger } from '@nestjs/common';
import { ScheduledTask } from '../interfaces/scheduled-task.interface';
import { ImportService } from '../../api/import-sage/import.service';

@Injectable()
export class SageImportTask implements ScheduledTask {
    private readonly logger = new Logger(SageImportTask.name);

    name = 'sage-import';
    description = 'Importación automática de usuarios SAGE desde SFTP';

    constructor(private readonly importService: ImportService) {}

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
        this.logger.log('📥 Descargando e importando CSV SAGE desde SFTP...');
        
        const jobId = await this.importService.startImportJobFromFtp();
        
        this.logger.log(`✅ Importación SAGE iniciada - Job ID: ${jobId}`);
    }
}
