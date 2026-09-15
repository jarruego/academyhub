import { serial, integer, text, index, uniqueIndex } from "drizzle-orm/pg-core";
import { academyhubSchema } from "../pg-schema";
import { TIMESTAMPS } from "./timestamps";
import { companyTable } from "./company.table";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Cliente a auditar en Consultoría (p. ej. VITALIA). Entidad propia de
// Consultoría, no toca el modelo core de empresa/centro — ver docs/consultoria.md.
export const consultingClientTable = academyhubSchema.table('consulting_clients', {
  id_consulting_client: serial().primaryKey(),
  name: text().notNull(),
  ...TIMESTAMPS,
});

// Empresas (ya existentes) que pertenecen a un cliente de consultoría.
export const consultingClientCompanyTable = academyhubSchema.table('consulting_client_companies', {
  id_consulting_client_company: serial().primaryKey(),
  id_consulting_client: integer().notNull().references(() => consultingClientTable.id_consulting_client),
  id_company: integer().notNull().references(() => companyTable.id_company),
  ...TIMESTAMPS,
}, (table) => {
  return {
    clientIdx: index("idx_consulting_client_companies_id_consulting_client").on(table.id_consulting_client),
    companyIdx: index("idx_consulting_client_companies_id_company").on(table.id_company),
    // Una empresa no puede estar dos veces en el mismo cliente.
    uniquePairIdx: uniqueIndex("idx_consulting_client_companies_unique_pair").on(table.id_consulting_client, table.id_company),
  };
});

export type ConsultingClientSelectModel = InferSelectModel<typeof consultingClientTable>;
export type ConsultingClientInsertModel = InferInsertModel<typeof consultingClientTable>;
export type ConsultingClientUpdateModel = Partial<ConsultingClientInsertModel>;

export type ConsultingClientCompanySelectModel = InferSelectModel<typeof consultingClientCompanyTable>;
export type ConsultingClientCompanyInsertModel = InferInsertModel<typeof consultingClientCompanyTable>;
