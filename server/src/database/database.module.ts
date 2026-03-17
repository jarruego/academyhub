import { Global, Logger, Module } from "@nestjs/common";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { DatabaseService } from "./database.service";
import * as schema from "./schema";

export const DATABASE_PROVIDER = "db-provider";

@Global()
@Module({
    providers: [
        {
            provide: DATABASE_PROVIDER,
            useFactory: async () => {
                const logger = new Logger("DatabaseModule");
                const connectionString = process.env.DATABASE_URL;

                if (!connectionString) {
                    throw new Error("DATABASE_URL is required");
                }

                // Supabase pooler on Render requires SSL in production.
                const useSsl = process.env.DB_SSL === "true" || process.env.NODE_ENV === "production";

                const pool = new Pool({
                    connectionString,
                    ssl: useSsl ? { rejectUnauthorized: false } : false,
                    max: Number(process.env.DB_POOL_MAX ?? 10),
                });

                pool.on("error", (err) => {
                    logger.error(`Postgres pool error: ${err?.message ?? err}`);
                });

                const db = drizzle(pool, { schema });
                return new DatabaseService(db);
            }
        }
    ],
    exports: [DATABASE_PROVIDER]
})
export class DatabaseModule {}
