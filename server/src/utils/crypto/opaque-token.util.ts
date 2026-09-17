import { randomBytes, createHash } from "crypto";

/**
 * Tokens opacos de alta entropía (acceso externo de centros a Consultoría —
 * ver docs/consultoria.md, "Guards y acceso externo"), no contraseñas de
 * usuario: a diferencia de `password-hashing.util.ts` (scryptSync + salt por
 * fila, pensado para ralentizar contraseñas de baja entropía), aquí el hash
 * tiene que ser determinista para poder buscar por igualdad en BD sin
 * escanear fila a fila — con 256 bits de entropía aleatoria, un hash rápido
 * (SHA-256) ya es indistinguible de fuerza bruta.
 */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
