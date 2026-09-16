// Script TEMPORAL, pensado para borrarse en cuanto deje de hacer falta (pedido
// explícito del usuario 2026-09-16) — no forma parte del flujo normal de la
// app ni se ejecuta desde ningún sitio salvo a mano. Misma lógica y mismos
// datos que los botones "Autorrellenar catálogo" / "Automapear puestos" del
// frontend (api/consultoria/catalog-seed/*, ADMIN-only) — ver la cabecera de
// src/api/consultoria/consultoria-catalog-seed.data.ts para el origen de
// esos datos (competencias, puestos y plantilla: reales, del Excel dado por
// el usuario; reglas de automapeo de job_position: mías, sin verificar).
//
// Uso: npx ts-node -r tsconfig-paths/register seed-consulting-job-catalog.ts
// Idempotente: no duplica competencias/puestos ya existentes por nombre, no
// pisa valores de plantilla ya guardados, y el automapeo solo toca valores
// de job_position que todavía no tengan alias.
import * as dotenv from "dotenv";
dotenv.config();

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "./src/database/schema";
import {
  DRAFT_COMPETENCIES,
  DRAFT_JOB_POSITIONS,
  POSITION_COMPETENCY_TEMPLATE,
  JOB_POSITION_MAPPING_RULES,
  normalizeJobPositionText,
  looksLikeGarbageJobPosition,
} from "./src/api/consultoria/consultoria-catalog-seed.data";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const useSsl = process.env.DB_SSL === "true" || process.env.NODE_ENV === "production";
  const pool = new Pool({ connectionString, ssl: useSsl ? { rejectUnauthorized: false } : false });
  const db = drizzle(pool, { schema });

  // --- Competencias ---
  const existingCompetencies = await db.select().from(schema.consulting_competencies);
  const existingCompetencyNames = new Set(existingCompetencies.map((c) => c.name));
  const newCompetencies = DRAFT_COMPETENCIES
    .map((name, i) => ({ name, display_order: i + 1 }))
    .filter((c) => !existingCompetencyNames.has(c.name));
  if (newCompetencies.length > 0) {
    await db.insert(schema.consulting_competencies).values(newCompetencies);
  }
  console.log(`Competencias: ${newCompetencies.length} nuevas.`);

  // --- Grupos de puestos de trabajo ---
  const existingGroups = await db.select().from(schema.consulting_job_position_groups);
  const groupIdByName = new Map(existingGroups.map((g) => [g.name, g.id_job_position_group]));
  let groupsCreated = 0;
  for (const jp of DRAFT_JOB_POSITIONS) {
    if (groupIdByName.has(jp.group_label)) continue;
    const rows = await db.insert(schema.consulting_job_position_groups).values({ name: jp.group_label }).returning();
    groupIdByName.set(jp.group_label, rows[0].id_job_position_group);
    groupsCreated++;
  }
  console.log(`Grupos de puestos: ${groupsCreated} nuevos.`);

  // --- Puestos de trabajo ---
  const existingJobPositions = await db.select().from(schema.consulting_job_positions);
  const existingJobPositionNames = new Set(existingJobPositions.map((p) => p.name));
  const newJobPositions = DRAFT_JOB_POSITIONS
    .map((p, i) => ({ name: p.name, id_job_position_group: groupIdByName.get(p.group_label), display_order: i + 1 }))
    .filter((p) => !existingJobPositionNames.has(p.name));
  if (newJobPositions.length > 0) {
    await db.insert(schema.consulting_job_positions).values(newJobPositions);
  }
  console.log(`Puestos de trabajo: ${newJobPositions.length} nuevos.`);

  const allCompetencies = await db.select().from(schema.consulting_competencies);
  const competencyIdByName = new Map(allCompetencies.map((c) => [c.name, c.id_competency]));
  const allJobPositions = await db.select().from(schema.consulting_job_positions);
  const jobPositionIdByName = new Map(allJobPositions.map((p) => [p.name, p.id_job_position]));

  // --- Plantilla real puesto↔competencia (Excel) ---
  let templateValuesSet = 0;
  for (const row of POSITION_COMPETENCY_TEMPLATE) {
    const id_job_position = jobPositionIdByName.get(row.jobPosition);
    if (!id_job_position) continue;
    const existingTemplate = await db.select().from(schema.consulting_position_competency_templates)
      .where(eq(schema.consulting_position_competency_templates.id_job_position, id_job_position));
    const alreadySet = new Set(existingTemplate.map((t) => t.id_competency));
    for (const competencyName of row.competencies) {
      const id_competency = competencyIdByName.get(competencyName);
      if (!id_competency || alreadySet.has(id_competency)) continue;
      await db.insert(schema.consulting_position_competency_templates)
        .values({ id_job_position, id_competency, default_value: true })
        .onConflictDoUpdate({
          target: [schema.consulting_position_competency_templates.id_job_position, schema.consulting_position_competency_templates.id_competency],
          set: { default_value: true },
        });
      templateValuesSet++;
    }
  }
  console.log(`Plantilla: ${templateValuesSet} valores fijados.`);

  // --- Automapeo de user.job_position contra el catálogo ---
  const [rawValues, existingAliases] = await Promise.all([
    db.selectDistinct({ job_position: schema.users.job_position }).from(schema.users),
    db.select({ job_position: schema.consulting_job_position_aliases.job_position }).from(schema.consulting_job_position_aliases),
  ]);
  const alreadyAliased = new Set(existingAliases.map((a) => a.job_position));
  const pending = rawValues
    .map((v) => v.job_position)
    .filter((v): v is string => !!v && v.trim() !== "" && !alreadyAliased.has(v));

  let mapped = 0;
  const unresolved: string[] = [];
  const flaggedAsGarbage: string[] = [];
  for (const raw of pending) {
    if (looksLikeGarbageJobPosition(raw)) {
      flaggedAsGarbage.push(raw);
      continue;
    }
    const normalized = normalizeJobPositionText(raw);
    const rule = JOB_POSITION_MAPPING_RULES.find((r) => r.fragments.some((f) => normalized.includes(f)));
    const id_job_position = rule ? jobPositionIdByName.get(rule.jobPosition) : undefined;
    if (!id_job_position) {
      unresolved.push(raw);
      continue;
    }
    await db.insert(schema.consulting_job_position_aliases)
      .values({ job_position: raw, id_job_position })
      .onConflictDoNothing({ target: schema.consulting_job_position_aliases.job_position });
    mapped++;
  }

  console.log(`Alias creados: ${mapped}.`);
  if (flaggedAsGarbage.length > 0) {
    console.log(`Valores que no parecen un puesto real (revisar el dato de origen), sin mapear: ${flaggedAsGarbage.join(", ")}`);
  }
  if (unresolved.length > 0) {
    console.log(`Sin coincidencia por palabra clave, quedan en "Puestos sin mapear" (${unresolved.length}): ${unresolved.join(", ")}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
