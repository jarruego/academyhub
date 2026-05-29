import { Injectable } from "@nestjs/common";
import { eq, lt } from "drizzle-orm";
import { Repository } from "src/database/repository/repository";
import { revoked_tokens } from "src/database/schema";

@Injectable()
export class RevokedTokenRepository extends Repository {
  async insert(jti: string, expiresAt: Date): Promise<void> {
    await this.dbService.db
      .insert(revoked_tokens)
      .values({ jti, expiresAt })
      .onConflictDoNothing();
  }

  async exists(jti: string): Promise<boolean> {
    const rows = await this.dbService.db
      .select({ jti: revoked_tokens.jti })
      .from(revoked_tokens)
      .where(eq(revoked_tokens.jti, jti))
      .limit(1);
    return rows.length > 0;
  }

  async deleteExpired(): Promise<void> {
    await this.dbService.db
      .delete(revoked_tokens)
      .where(lt(revoked_tokens.expiresAt, new Date()));
  }
}
