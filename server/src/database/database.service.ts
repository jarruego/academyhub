import * as schema from './schema';
import { Injectable } from "@nestjs/common";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";

@Injectable()
export class DatabaseService<
  TSchema extends Record<string, unknown> = typeof schema,
> {
  constructor(public readonly db: PostgresJsDatabase<TSchema>) {}
}
