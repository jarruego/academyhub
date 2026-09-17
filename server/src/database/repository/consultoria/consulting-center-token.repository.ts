import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { Repository, QueryOptions } from "../repository";
import { consultingCenterTokenTable } from "src/database/schema/tables/consulting_center_token.table";

@Injectable()
export class ConsultingCenterTokenRepository extends Repository {
  async findByCenter(id_center: number, options?: QueryOptions) {
    const rows = await this.query(options).select().from(consultingCenterTokenTable).where(eq(consultingCenterTokenTable.id_center, id_center));
    return rows[0];
  }

  async findByTokenHash(token_hash: string, options?: QueryOptions) {
    const rows = await this.query(options).select().from(consultingCenterTokenTable).where(eq(consultingCenterTokenTable.token_hash, token_hash));
    return rows[0];
  }

  /** Genera o regenera: sustituye el hash y el cifrado anteriores (invalida el enlace viejo al momento) y limpia cualquier revocación previa. */
  async issue(id_center: number, token_hash: string, token_encrypted: string | null, options?: QueryOptions) {
    const rows = await this.query(options)
      .insert(consultingCenterTokenTable)
      .values({ id_center, token_hash, token_encrypted })
      .onConflictDoUpdate({
        target: consultingCenterTokenTable.id_center,
        set: { token_hash, token_encrypted, created_at: new Date(), last_used_at: null, revoked_at: null },
      })
      .returning();
    return rows[0];
  }

  async revoke(id_center: number, options?: QueryOptions) {
    const rows = await this.query(options)
      .update(consultingCenterTokenTable)
      .set({ revoked_at: new Date() })
      .where(eq(consultingCenterTokenTable.id_center, id_center))
      .returning();
    return rows[0];
  }

  async touchLastUsed(id_center: number, options?: QueryOptions) {
    await this.query(options)
      .update(consultingCenterTokenTable)
      .set({ last_used_at: new Date() })
      .where(eq(consultingCenterTokenTable.id_center, id_center));
  }
}
