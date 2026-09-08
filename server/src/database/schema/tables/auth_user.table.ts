import { serial, varchar, boolean } from "drizzle-orm/pg-core";
import { academyhubSchema } from "../pg-schema";
import { TIMESTAMPS } from "./timestamps";
import { Role } from "src/guards/role.enum";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const authUserTable = academyhubSchema.table('auth_users', {
    id: serial().primaryKey(),
    name: varchar({length: 32}).notNull(),
    lastName: varchar({length: 64}),
    email: varchar({length: 128}).notNull().unique(),
    username: varchar({length: 32}).notNull().unique(),
    password: varchar({length: 256}).notNull(),
    role: varchar({ length: 16 }).notNull().default(Role.VIEWER),
    // Permiso puntual independiente del rol: gestión de candidaturas de una
    // edición (pestañas Planificación y selección + Candidatos, incluye
    // importar el fichero de Preinscripciones INAEM acotado a esa edición)
    // sin dar acceso a Acciones/Alumnos ni al resto de capacidades de
    // ADMIN/MANAGER.
    can_manage_candidates: boolean().notNull().default(false),
    ...TIMESTAMPS,
});

export type AuthUserSelectModel = InferSelectModel<typeof authUserTable>;
export type AuthUserInsertModel = InferInsertModel<typeof authUserTable>;
export type AuthUserUpdateModel = Partial<AuthUserInsertModel>;