// Backfill puntual: genera un token de acceso externo (ver
// docs/consultoria.md, "Guards y acceso externo") para todo centro que
// participe en al menos una consultoría anual `OPEN` y todavía no tenga
// fila en consulting_center_tokens. **Corregido 2026-09-16→17**: la primera
// versión lo hacía para TODOS los centros de la app ("todos los centros
// tengan un token generado, salvo que se haya revocado") — demasiado
// amplio, el usuario aclaró que es única y exclusivamente para los que
// están dentro de una consultoría abierta; el resto no debe tener ni token
// ni la pestaña "Consultoría" siquiera visible. Idempotente: nunca toca un
// centro que ya tiene fila (revocada o no), y nunca crea una para un centro
// fuera de una consultoría abierta. La misma generación "por defecto"
// también ocurre sola la primera vez que se abre la pestaña "Consultoría"
// de un centro elegible (`ConsultingCenterTokenService.getStatus`); este
// script solo adelanta ese momento para los que ya existían, de una vez.
//
// Uso: npx ts-node -r tsconfig-paths/register seed-consulting-center-tokens.ts
import * as dotenv from "dotenv";
dotenv.config();

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "./src/database/schema";
import { generateOpaqueToken, hashOpaqueToken } from "./src/utils/crypto/opaque-token.util";
import { encryptSecretToString } from "./src/utils/crypto/secrets.util";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const useSsl = process.env.DB_SSL === "true" || process.env.NODE_ENV === "production";
  const pool = new Pool({ connectionString, ssl: useSsl ? { rejectUnauthorized: false } : false });
  const db = drizzle(pool, { schema });

  const openEngagementCenters = await db
    .select({ id_center: schema.consulting_engagement_centers.id_center })
    .from(schema.consulting_engagement_centers)
    .innerJoin(schema.consulting_annual_engagements, eq(schema.consulting_annual_engagements.id_annual_engagement, schema.consulting_engagement_centers.id_annual_engagement))
    .where(eq(schema.consulting_annual_engagements.status, "OPEN"));
  const eligibleCenterIds = new Set(openEngagementCenters.map((c) => c.id_center));

  const existingTokens = await db.select({ id_center: schema.consulting_center_tokens.id_center }).from(schema.consulting_center_tokens);
  const centersWithToken = new Set(existingTokens.map((t) => t.id_center));

  const missing = [...eligibleCenterIds].filter((id_center) => !centersWithToken.has(id_center));
  console.log(`${eligibleCenterIds.size} centros en alguna consultoría abierta, ${missing.length} sin token todavía.`);

  for (const id_center of missing) {
    const token = generateOpaqueToken();
    await db.insert(schema.consulting_center_tokens).values({
      id_center,
      token_hash: hashOpaqueToken(token),
      token_encrypted: encryptSecretToString(token) ?? null,
    });
  }

  console.log(`${missing.length} tokens generados.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
