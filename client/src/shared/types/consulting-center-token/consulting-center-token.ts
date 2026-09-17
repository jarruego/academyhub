// Token único y exclusivamente para centros dentro de una consultoría
// abierta (ver ConsultingCenterTokenService.getStatus) — el resto de
// centros no tiene fila y no debe verla: `exists: false`.
export type ConsultingCenterTokenStatus =
    | { exists: false }
    | { exists: true; token: string | null; created_at: string; last_used_at: string | null; revoked_at: string | null };
