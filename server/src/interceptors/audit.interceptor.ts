import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DATABASE_PROVIDER } from 'src/database/database.module';
import { DatabaseService } from 'src/database/database.service';
import { audit_log } from 'src/database/schema';

// Solo se auditan operaciones que modifican estado. Los GET (lectura, alto
// volumen) se ignoran.
const AUDITED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Registra en `audit_log` quién realiza cada operación mutante (método, ruta,
 * actor, código de estado, IP). Diseñado para NO afectar nunca a la petición:
 * - solo actúa tras completarse el handler (rxjs tap),
 * - la escritura es best-effort (fire-and-forget, con try/catch interno),
 * - NO registra el cuerpo de la petición (evita guardar contraseñas/tokens).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest();
    const method: string | undefined = req?.method;
    if (!method || !AUDITED_METHODS.has(method)) return next.handle();

    return next.handle().pipe(
      tap({
        next: () => {
          // Best-effort: cualquier fallo aquí jamás debe afectar a la respuesta.
          try {
            const statusCode = context.switchToHttp().getResponse()?.statusCode;
            void this.record(req, statusCode);
          } catch {
            /* swallow */
          }
        },
      }),
    );
  }

  private async record(req: any, statusCode?: number): Promise<void> {
    try {
      const user = req?.user ?? {};

      let target: string | null = null;
      try {
        const params = req?.params;
        target =
          params && Object.keys(params).length
            ? JSON.stringify(params).slice(0, 500)
            : null;
      } catch {
        target = null;
      }

      await this.databaseService.db.insert(audit_log).values({
        actor_id: typeof user.id === 'number' ? user.id : null,
        actor_username: user.username ? String(user.username).slice(0, 64) : null,
        actor_role: user.role ? String(user.role).slice(0, 16) : null,
        method: String(req?.method ?? '').slice(0, 10),
        path: String(req?.originalUrl ?? req?.url ?? '').slice(0, 1000),
        target,
        status_code: typeof statusCode === 'number' ? statusCode : null,
        ip: req?.ip ? String(req.ip).slice(0, 64) : null,
      });
    } catch (err) {
      // Nunca propagar: la auditoría no puede tumbar una operación de negocio.
      this.logger.warn(
        `No se pudo registrar auditoría: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
