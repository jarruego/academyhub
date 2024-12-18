
import { Inject } from "@nestjs/common";
import { DATABASE_PROVIDER } from "../database.module";
import { DatabaseService } from "../database.service";

export type Transaction = Parameters<
  Parameters<DatabaseService["db"]["transaction"]>[0]
>[0];

export type QueryOptions = {
  transaction?: Transaction;
};

export abstract class Repository {
  constructor(
    @Inject(DATABASE_PROVIDER)
    protected readonly dbService: DatabaseService
  ) {}

  protected query = (options?: QueryOptions) =>
    options?.transaction || this.dbService.db;

  public transaction: typeof this.dbService.db.transaction = (options) =>
    this.dbService.db.transaction(options);
}
