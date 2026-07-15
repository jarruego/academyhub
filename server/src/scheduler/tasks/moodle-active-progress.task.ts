import { Injectable, Logger } from '@nestjs/common';
import { ScheduledTask } from '../interfaces/scheduled-task.interface';
import { MoodleService } from '../../api/moodle/moodle.service';
import { AdminNotificationService } from '../../notifications/admin-notification.service';

@Injectable()
export class MoodleActiveProgressTask implements ScheduledTask {
    private readonly logger = new Logger(MoodleActiveProgressTask.name);

    name = 'moodle-active-progress';
    description = 'Sincroniza progreso de cursos activos desde Moodle';

    constructor(
        private readonly moodleService: MoodleService,
        private readonly adminNotificationService: AdminNotificationService,
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
        this.logger.log('🔄 Refrescando progreso/tiempo de cursos activos (metrics-only)...');

        let courses;
        try {
            courses = await this.moodleService.getActiveCoursesProgress();
        } catch (err) {
            // Fallo global (no se pudo ni obtener la lista de cursos activos):
            // avisar a los administradores y relanzar para que el scheduler lo registre.
            const msg = err instanceof Error ? err.message : String(err);
            await this.adminNotificationService.notifyScheduledJobFailure({
                source: 'Sincronización de progreso de Moodle',
                error: msg,
            });
            throw err;
        }

        const callsBefore = this.moodleService.moodleCallCount;
        let syncedCourses = 0;
        let totalUpdated = 0;
        let failedCourses = 0;
        const failedDetails: string[] = [];

        // Refresco a nivel de curso: solo progreso/tiempo de alumnos ya existentes.
        // ~2 llamadas a Moodle por curso (finalización + tiempo en bloque), en vez
        // de 1 llamada por usuario × grupo. No da de alta usuarios nuevos: eso es
        // tarea de los importadores manuales / "Traer de Moodle".
        for (const course of courses) {
            if (!course.moodle_id) continue;
            try {
                const { updated } = await this.moodleService.refreshActiveCourseProgress(course);
                totalUpdated += updated;
                syncedCourses++;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                failedCourses++;
                // Guardar solo una muestra para el correo (evita cuerpos enormes).
                if (failedDetails.length < 10) {
                    failedDetails.push(`${course.course_name}: ${msg}`);
                }
                this.logger.error(`❌ Error refrescando curso ${course.course_name}: ${msg}`);
            }
        }

        const moodleCalls = this.moodleService.moodleCallCount - callsBefore;
        this.logger.log(`✅ Refresco finalizado: ${syncedCourses}/${courses.length} cursos, ${totalUpdated} inscripciones actualizadas, ${moodleCalls} llamadas a Moodle`);

        // Fallos parciales (algún curso no se pudo sincronizar): avisar a admins
        // pero sin lanzar, para no marcar como fallida toda la tarea.
        if (failedCourses > 0) {
            await this.adminNotificationService.notifyScheduledJobFailure({
                source: 'Sincronización de progreso de Moodle',
                error: `${failedCourses} de ${courses.length} curso(s) no se pudieron sincronizar`,
                details: failedDetails.join('\n'),
            });
        }
    }
}
