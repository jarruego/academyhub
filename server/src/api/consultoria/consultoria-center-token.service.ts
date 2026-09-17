import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConsultingCenterTokenRepository } from "src/database/repository/consultoria/consulting-center-token.repository";
import { ConsultingEngagementCenterRepository } from "src/database/repository/consultoria/consulting-engagement-center.repository";
import { CenterRepository } from "src/database/repository/center/center.repository";
import { generateOpaqueToken, hashOpaqueToken } from "src/utils/crypto/opaque-token.util";
import { encryptSecretToString, decryptSecretFromString } from "src/utils/crypto/secrets.util";
import { ConsultingEngagementStatus } from "src/types/consulting/consulting-engagement-status.enum";

/**
 * Gestión ADMIN del token de acceso externo de un centro (ver
 * docs/consultoria.md, "Guards y acceso externo") — desde la ficha del
 * centro: generar/regenerar (invalida el enlace anterior al momento),
 * revocar, y **volver a ver/copiar el token en cualquier momento**
 * (2026-09-17, pedido explícito del usuario — antes solo se devolvía una
 * vez, igual que un API key de GitHub/Stripe). Se guarda cifrado de forma
 * reversible con `APP_MASTER_KEY` (mismo mecanismo que la contraseña SMTP
 * de organización) — no en claro — además del hash que sigue usando
 * `ConsultingTokenGuard` para autenticar cada petición.
 *
 * **Token único y exclusivamente para centros dentro de una consultoría
 * abierta** (2026-09-17, corrección del mismo día — antes "todo centro
 * tenía token por defecto", demasiado amplio: la mayoría de centros de la
 * app no tienen nada que ver con Consultoría). `getStatus` lo genera solo
 * (idempotente) si el centro participa en al menos una consultoría anual
 * `OPEN` y todavía no tiene fila — nunca si ya existe una (revocada o no) ni
 * si el centro no participa en ninguna consultoría abierta. `issue`
 * (generar/regenerar a mano) exige la misma condición. El resto de centros
 * no tiene ni token ni la pestaña "Consultoría" siquiera se les muestra
 * (`center-detail.route.tsx`, en el frontend).
 */
@Injectable()
export class ConsultingCenterTokenService {
  constructor(
    private readonly consultingCenterTokenRepository: ConsultingCenterTokenRepository,
    private readonly consultingEngagementCenterRepository: ConsultingEngagementCenterRepository,
    private readonly centerRepository: CenterRepository,
  ) {}

  private async assertCenterExists(id_center: number) {
    const center = await this.centerRepository.findById(id_center);
    if (!center) throw new NotFoundException("Centro no encontrado");
  }

  private async isInOpenEngagement(id_center: number): Promise<boolean> {
    const engagements = await this.consultingEngagementCenterRepository.findByCenterId(id_center);
    return engagements.some((e) => e.status === ConsultingEngagementStatus.OPEN);
  }

  private async issueForCenter(id_center: number) {
    const token = generateOpaqueToken();
    const record = await this.consultingCenterTokenRepository.issue(id_center, hashOpaqueToken(token), encryptSecretToString(token) ?? null);
    return { token, record };
  }

  async getStatus(id_center: number) {
    await this.assertCenterExists(id_center);
    let record = await this.consultingCenterTokenRepository.findByCenter(id_center);
    let token: string | null | undefined;
    if (!record) {
      if (!(await this.isInOpenEngagement(id_center))) return { exists: false as const };
      ({ token, record } = await this.issueForCenter(id_center));
    } else {
      token = decryptSecretFromString(record.token_encrypted);
    }
    return {
      exists: true as const,
      token: token ?? null,
      created_at: record.created_at,
      last_used_at: record.last_used_at,
      revoked_at: record.revoked_at,
    };
  }

  async issue(id_center: number) {
    await this.assertCenterExists(id_center);
    if (!(await this.isInOpenEngagement(id_center))) {
      throw new BadRequestException("Este centro no participa en ninguna consultoría abierta — no se le puede generar un token.");
    }
    const { token } = await this.issueForCenter(id_center);
    return { token };
  }

  async revoke(id_center: number) {
    await this.assertCenterExists(id_center);
    const record = await this.consultingCenterTokenRepository.findByCenter(id_center);
    if (!record) throw new NotFoundException("Este centro no tiene token generado");
    await this.consultingCenterTokenRepository.revoke(id_center);
    return { success: true };
  }
}
