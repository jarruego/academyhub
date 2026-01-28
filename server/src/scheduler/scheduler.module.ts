import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { SageImportTask } from './tasks/sage-import.task';
import { MoodleActiveProgressTask } from './tasks/moodle-active-progress.task';
import { ImportModule } from '../api/import-sage/import.module';
import { MoodleModule } from '../api/moodle/moodle.module';

@Module({
    imports: [ImportModule, MoodleModule],
    providers: [
        SchedulerService,
        SageImportTask,
        MoodleActiveProgressTask,
        {
            provide: 'SCHEDULER_INIT',
            useFactory: (schedulerService: SchedulerService, sageImportTask: SageImportTask, moodleActiveProgressTask: MoodleActiveProgressTask) => {
                // Registrar todas las tareas programadas
                schedulerService.registerTask(sageImportTask);
                schedulerService.registerTask(moodleActiveProgressTask);
                return schedulerService;
            },
            inject: [SchedulerService, SageImportTask, MoodleActiveProgressTask]
        }
    ],
    exports: [SchedulerService]
})
export class SchedulerModule {}
