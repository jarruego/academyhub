import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { SageImportTask } from './tasks/sage-import.task';
import { ImportModule } from '../api/import-sage/import.module';

@Module({
    imports: [ImportModule],
    providers: [
        SchedulerService,
        SageImportTask,
        {
            provide: 'SCHEDULER_INIT',
            useFactory: (schedulerService: SchedulerService, sageImportTask: SageImportTask) => {
                // Registrar todas las tareas programadas
                schedulerService.registerTask(sageImportTask);
                return schedulerService;
            },
            inject: [SchedulerService, SageImportTask]
        }
    ],
    exports: [SchedulerService]
})
export class SchedulerModule {}
