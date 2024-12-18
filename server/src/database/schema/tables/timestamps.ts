import { timestamp } from "drizzle-orm/pg-core";

export const TIMESTAMPS = {
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
}