import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as cron from 'node-cron';
import { ScheduledTask } from './interfaces/scheduled-task.interface';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(SchedulerService.name);
    private tasks: Map<string, { task: ScheduledTask; cronJob?: cron.ScheduledTask }> = new Map();

    /**
     * Registrar una tarea programada
     */
    registerTask(task: ScheduledTask) {
        if (this.tasks.has(task.name)) {
            this.logger.warn(`⚠️  Tarea "${task.name}" ya está registrada. Se sobrescribirá.`);
        }
        
        this.tasks.set(task.name, { task });
        this.logger.log(`📝 Tarea registrada: ${task.name} - ${task.description}`);
    }

    onModuleInit() {
        const enabled = (process.env.ENABLE_CRON_SCHEDULER || '').toLowerCase() === 'true';
        
        if (!enabled) {
            this.logger.log('📅 Scheduler desactivado (ENABLE_CRON_SCHEDULER=false)');
            return;
        }

        this.logger.log('📅 Iniciando scheduler con expresiones cron...');
        
        let activeTasksCount = 0;
        
        for (const [name, { task }] of this.tasks) {
            if (!task.enabled) {
                this.logger.log(`⏭️  Tarea omitida (deshabilitada): ${name}`);
                continue;
            }

            activeTasksCount++;
            
            this.logger.log(`⏰ Programando: ${name} - Cron: "${task.cronExpression}"`);

            // Ejecutar al inicio si está configurado
            if (task.runOnStartup) {
                this.logger.log(`🚀 Ejecutando "${name}" al arranque...`);
                this.executeTask(task);
            }

            // Programar ejecuciones con cron
            try {
                const cronJob = cron.schedule(task.cronExpression, () => {
                    this.executeTask(task);
                }, {
                    timezone: process.env.SCHEDULER_TIMEZONE || 'UTC'
                });

                const taskEntry = this.tasks.get(name);
                if (taskEntry) {
                    taskEntry.cronJob = cronJob;
                }
            } catch (error) {
                this.logger.error(
                    `❌ Error configurando cron "${task.cronExpression}" para ${name}: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }

        if (activeTasksCount === 0) {
            this.logger.warn('⚠️  No hay tareas programadas activas');
        } else {
            this.logger.log(`✅ Scheduler iniciado con ${activeTasksCount} tarea(s) activa(s)`);
        }
    }

    onModuleDestroy() {
        this.logger.log('🛑 Deteniendo scheduler...');
        
        for (const [name, { cronJob }] of this.tasks) {
            if (cronJob) {
                cronJob.stop();
                this.logger.log(`🛑 Tarea detenida: ${name}`);
            }
        }
        
        this.tasks.clear();
    }

    /**
     * Ejecutar una tarea manualmente
     */
    async executeTaskManually(taskName: string): Promise<void> {
        const taskEntry = this.tasks.get(taskName);
        
        if (!taskEntry) {
            throw new Error(`Tarea "${taskName}" no encontrada`);
        }

        this.logger.log(`🔄 Ejecución manual de: ${taskName}`);
        await this.executeTask(taskEntry.task);
    }

    /**
     * Obtener lista de tareas registradas
     */
    getTasks(): Array<{ name: string; description: string; enabled: boolean; cronExpression: string }> {
        return Array.from(this.tasks.values()).map(({ task }) => ({
            name: task.name,
            description: task.description,
            enabled: task.enabled,
            cronExpression: task.cronExpression
        }));
    }

    /**
     * Método privado para ejecutar una tarea con manejo de errores
     */
    private async executeTask(task: ScheduledTask): Promise<void> {
        try {
            this.logger.log(`🔄 Iniciando: ${task.name}`);
            await task.execute();
            this.logger.log(`✅ Completado: ${task.name}`);
        } catch (error) {
            this.logger.error(
                `❌ Error en ${task.name}: ${error instanceof Error ? error.message : String(error)}`
            );
            // No lanzar el error para que el scheduler continúe funcionando
        }
    }
}
