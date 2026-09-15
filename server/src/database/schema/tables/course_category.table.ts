import { serial, text, boolean, integer } from "drizzle-orm/pg-core";
import { academyhubSchema } from "../pg-schema";
import { TIMESTAMPS } from "./timestamps";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Catálogo editable de categorías de curso (p. ej. Higiene, PRL, SGI...).
// Sustituye a courses.category (texto libre, sin uso real: 0 valores en BD,
// sin pantalla que lo mostrara) — administrado solo por ADMIN. Nace a raíz
// de Consultoría pero es del núcleo de cursos, no de ese módulo — ver
// docs/consultoria.md.
export const courseCategoryTable = academyhubSchema.table('course_categories', {
  id_category: serial().primaryKey(),
  name: text().notNull(),
  active: boolean().notNull().default(true),
  display_order: integer(),
  ...TIMESTAMPS,
});

export type CourseCategorySelectModel = InferSelectModel<typeof courseCategoryTable>;
export type CourseCategoryInsertModel = InferInsertModel<typeof courseCategoryTable>;
export type CourseCategoryUpdateModel = Partial<CourseCategoryInsertModel>;
