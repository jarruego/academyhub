import { serial, text, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { academyhubSchema } from "../pg-schema";
import { consultingJobPositionTable } from "./consulting_job_position.table";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// `user.job_position` es texto libre y poco fiable ("Gerocultor/a" vs
// "gerocultora" vs "GEROCULTOR"...) — comparar contra el nombre del catálogo
// de 28 puestos no es suficiente. Esta tabla mapea cada valor tal cual
// aparece en `job_position` al puesto del catálogo que le corresponde,
// mantenida solo por ADMIN. Ver docs/consultoria.md.
export const consultingJobPositionAliasTable = academyhubSchema.table('consulting_job_position_aliases', {
  id_job_position_alias: serial().primaryKey(),
  job_position: text().notNull(),
  id_job_position: integer().notNull().references(() => consultingJobPositionTable.id_job_position),
}, (table) => {
  return {
    uniqueJobPositionIdx: uniqueIndex("idx_consulting_job_position_aliases_unique_job_position").on(table.job_position),
  };
});

export type ConsultingJobPositionAliasSelectModel = InferSelectModel<typeof consultingJobPositionAliasTable>;
export type ConsultingJobPositionAliasInsertModel = InferInsertModel<typeof consultingJobPositionAliasTable>;
