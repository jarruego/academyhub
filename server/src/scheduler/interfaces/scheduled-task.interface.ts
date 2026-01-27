/**
 * Interfaz para definir tareas programadas
 */
export interface ScheduledTask {
    /**
     * Nombre único de la tarea
     */
    name: string;

    /**
     * Descripción de la tarea (para logs)
     */
    description: string;

    /**
     * Expresión cron para programar la ejecución
     * Ejemplos:
     * - 0 2 * * * = 2:00 AM todos los días
     * - 0 *\/6 * * * = cada 6 horas
     * - 0 3 * * 1-5 = 3:00 AM de lunes a viernes
     * - 0 * * * * = cada hora
     */
    cronExpression: string;

    /**
     * Si debe ejecutarse inmediatamente al arrancar
     */
    runOnStartup: boolean;

    /**
     * Si la tarea está habilitada
     */
    enabled: boolean;

    /**
     * Método que se ejecutará periódicamente
     */
    execute(): Promise<void>;
}
