import { pgTable, serial, varchar } from "drizzle-orm/pg-core";
import { TIMESTAMPS } from "./timestamps";
import { Role } from "src/guards/role.enum";

export const authUserTable = pgTable('auth_users', {
    id: serial().primaryKey(),
    name: varchar({length: 32}).notNull(),
    lastName: varchar({length: 64}),
    email: varchar({length: 128}).notNull().unique(),
    username: varchar({length: 32}).notNull().unique(),
    password: varchar({length: 256}).notNull(),
    role: varchar({ length: 16 }).notNull().default(Role.VIEWER),
    ...TIMESTAMPS,
});