import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import { ConsultingCenterTokenRepository } from "src/database/repository/consultoria/consulting-center-token.repository";
import { hashOpaqueToken } from "src/utils/crypto/opaque-token.util";

/**
 * Guarda el acceso externo de un centro a su consultoría (token opaco, no
 * JWT — ver docs/consultoria.md, "Guards y acceso externo"). Solo se monta
 * en `ConsultingCentroController`, nunca en las rutas internas — sin
 * ambigüedad con el `AuthGuard` normal.
 *
 * No hay un `auth_user` real detrás de este acceso (se descartó esa vuelta
 * del diseño — el `audit_log` ya resuelve la trazabilidad por
 * username/ruta, sin necesitar una fila técnica por centro con contraseña
 * inventada). `request['user']` se rellena con una identidad sintética solo
 * para que el `AuditInterceptor` existente registre quién hizo qué sin
 * tocarlo; los `*_by` de negocio (`created_by`/`evaluated_by`...) siguen
 * quedando NULL cuando el origen es este token, tal como ya estaba
 * decidido en el modelo de datos.
 */
@Injectable()
export class ConsultingTokenGuard implements CanActivate {
  constructor(private readonly consultingCenterTokenRepository: ConsultingCenterTokenRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    if (!token) throw new UnauthorizedException();

    const record = await this.consultingCenterTokenRepository.findByTokenHash(hashOpaqueToken(token));
    if (!record || record.revoked_at) throw new UnauthorizedException();

    void this.consultingCenterTokenRepository.touchLastUsed(record.id_center);

    (request as unknown as Record<string, unknown>)["user"] = {
      id: null,
      username: `centro:${record.id_center}`,
      role: undefined,
    };
    (request as unknown as Record<string, unknown>)["id_center"] = record.id_center;
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }
}
