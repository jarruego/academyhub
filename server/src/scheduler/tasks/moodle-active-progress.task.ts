import { Injectable, Logger } from '@nestjs/common';
import { ScheduledTask } from '../interfaces/scheduled-task.interface';
import { MoodleService } from '../../api/moodle/moodle.service';
import { DistributedLock } from '../utils/distributed-lock';

@Injectable()
export class MoodleActiveProgressTask implements ScheduledTask {
    private readonly logger = new Logger(MoodleActiveProgressTask.name);

    name = 'moodle-active-progress';
    description = 'Sincroniza progreso de cursos activos desde Moodle';

    constructor(
        private readonly moodleService: MoodleService,
        private readonly distributedLock: DistributedLock
    ) {}

    get enabled(): boolean {
        return (process.env.MOODLE_ACTIVE_SYNC_ENABLED || 'false').toLowerCase() === 'true';
    }

    get cronExpression(): string {
        return process.env.MOODLE_ACTIVE_SYNC_CRON || '0 4 * * *';
    }

    get runOnStartup(): boolean {
        return false;
    }

    async execute(): Promise<void> {
        const lockKey = 'moodle-active-progress-lock';

        if (!(await this.distributedLock.acquire(lockKey, 10800))) { // 3 hours TTL
            this.logger.log('⏭️ Tarea saltada: otra instancia ya está sincronizando');
            return;
        }

        try {
            this.logger.log('🔄 Sincronizando cursos activos...');

            const courses = await this.moodleService.getActiveCoursesProgress();
            let totalGroups = 0;
            let syncedGroups = 0;

            for (const course of courses) {
                for (const group of course.groups) {
                    totalGroups++;
                    if (!group.moodle_id) continue;
                    try {
                        await this.moodleService.syncMoodleGroupMembers(group.moodle_id);
                        syncedGroups++;
                    } catch (err) {
                        const msg = err instanceof Error ? err.message : String(err);
                        this.logger.error(`❌ Error sincronizando grupo ${group.group_name}: ${msg}`);
                    }
                }
            }

            this.logger.log(`✅ Sincronización finalizada: ${syncedGroups}/${totalGroups} grupos`);
        } finally {
            await this.distributedLock.release(lockKey);
        }
    }
}
