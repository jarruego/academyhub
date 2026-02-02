import { Injectable, Logger, Inject } from '@nestjs/common';
import { DATABASE_PROVIDER } from 'src/database/database.module';
import { DatabaseService } from 'src/database/database.service';
import { sql } from 'drizzle-orm';

/**
 * Lock distribuido para evitar que múltiples instancias ejecuten la misma tarea
 * Usa un registro en BD con timestamp para validar que no está expirado
 */
@Injectable()
export class DistributedLock {
    private readonly logger = new Logger(DistributedLock.name);

    constructor(@Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService) {}

    /**
     * Intenta adquirir un lock
     * @param lockKey Identificador único del lock (ej: 'sage-import-lock')
     * @param ttlSeconds Tiempo de vida del lock en segundos (default: 30)
     * @returns true si se adquirió el lock, false si ya existe uno activo
     */
    async acquire(lockKey: string, ttlSeconds: number = 30): Promise<boolean> {
        try {
            const now = new Date();
            const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

            // Intenta insertar un nuevo lock
            // Si ya existe con el mismo key y no está expirado, falla
            const result = await this.databaseService.db.execute(
                sql`INSERT INTO scheduler_locks (lock_key, acquired_at, expires_at)
                    VALUES (${lockKey}, ${now}, ${expiresAt})
                    ON CONFLICT (lock_key) DO NOTHING
                    RETURNING lock_key`
            );

            if (result && result.rows && result.rows.length > 0) {
                this.logger.log(`🔒 Lock adquirido: ${lockKey}`);
                return true;
            }

            // El lock ya existe, verificar si está expirado
            const existingLock = await this.databaseService.db.execute(
                sql`SELECT expires_at FROM scheduler_locks 
                    WHERE lock_key = ${lockKey}`
            );

            if (existingLock && existingLock.rows && existingLock.rows.length > 0) {
                const lockExpiresAt = new Date(existingLock.rows[0].expires_at as string);
                if (lockExpiresAt < now) {
                    // Lock expirado, intentar tomar el lock nuevamente
                    await this.databaseService.db.execute(
                        sql`UPDATE scheduler_locks 
                            SET acquired_at = ${now}, expires_at = ${new Date(now.getTime() + ttlSeconds * 1000)}
                            WHERE lock_key = ${lockKey}`
                    );
                    this.logger.log(`🔒 Lock adquirido (expirado anterior): ${lockKey}`);
                    return true;
                }
            }

            this.logger.warn(`⏭️ Lock no disponible: ${lockKey} (otra instancia ejecutando)`);
            return false;
        } catch (error) {
            this.logger.error(
                `❌ Error adquiriendo lock: ${error instanceof Error ? error.message : String(error)}`
            );
            // En caso de error, permitir ejecución (mejor ejecutar que no hacer nada)
            return true;
        }
    }

    /**
     * Libera un lock
     */
    async release(lockKey: string): Promise<void> {
        try {
            await this.databaseService.db.execute(
                sql`DELETE FROM scheduler_locks WHERE lock_key = ${lockKey}`
            );
            this.logger.log(`🔓 Lock liberado: ${lockKey}`);
        } catch (error) {
            this.logger.error(
                `❌ Error liberando lock: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}
