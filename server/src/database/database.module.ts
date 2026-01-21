import { Global, Module } from "@nestjs/common";
import { drizzle } from "drizzle-orm/node-postgres";
import { DatabaseService } from "./database.service";
import * as schema from "./schema";

export const DATABASE_PROVIDER = "db-provider";

@Global()
@Module({
    providers: [
        {
            provide: DATABASE_PROVIDER,
            useFactory: async () => {
                const db = drizzle(process.env.DATABASE_URL, { schema });
                return new DatabaseService(db);
            }
        }
    ],
    exports: [DATABASE_PROVIDER]
})
export class DatabaseModule {}