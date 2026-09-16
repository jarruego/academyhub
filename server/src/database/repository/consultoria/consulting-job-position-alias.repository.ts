import { Injectable } from "@nestjs/common";
import { eq, isNotNull } from "drizzle-orm";
import { Repository, QueryOptions } from "../repository";
import { consultingJobPositionAliasTable } from "src/database/schema/tables/consulting_job_position_alias.table";
import { consultingJobPositionTable } from "src/database/schema/tables/consulting_job_position.table";
import { userTable } from "src/database/schema/tables/user.table";

@Injectable()
export class ConsultingJobPositionAliasRepository extends Repository {
  async findAll(options?: QueryOptions) {
    return this.query(options)
      .select({
        id_job_position_alias: consultingJobPositionAliasTable.id_job_position_alias,
        job_position: consultingJobPositionAliasTable.job_position,
        id_job_position: consultingJobPositionAliasTable.id_job_position,
        job_position_name: consultingJobPositionTable.name,
      })
      .from(consultingJobPositionAliasTable)
      .innerJoin(consultingJobPositionTable, eq(consultingJobPositionAliasTable.id_job_position, consultingJobPositionTable.id_job_position))
      .orderBy(consultingJobPositionAliasTable.job_position);
  }

  /** Valores tal cual de `user.job_position` que todavía no tienen alias — para la pantalla "Puestos sin mapear". */
  async findUnmapped(options?: QueryOptions) {
    const [distinctValues, aliases] = await Promise.all([
      this.query(options)
        .selectDistinct({ job_position: userTable.job_position })
        .from(userTable)
        .where(isNotNull(userTable.job_position)),
      this.query(options).select({ job_position: consultingJobPositionAliasTable.job_position }).from(consultingJobPositionAliasTable),
    ]);
    const aliased = new Set(aliases.map((a) => a.job_position));
    return distinctValues
      .map((v) => v.job_position)
      .filter((v): v is string => !!v && v.trim() !== '' && !aliased.has(v));
  }

  /** Alta o cambio de mapeo — `job_position` es único, así que reasignar el mismo texto sustituye el destino. */
  async upsert(job_position: string, id_job_position: number, options?: QueryOptions) {
    const rows = await this.query(options)
      .insert(consultingJobPositionAliasTable)
      .values({ job_position, id_job_position })
      .onConflictDoUpdate({
        target: consultingJobPositionAliasTable.job_position,
        set: { id_job_position },
      })
      .returning();
    return rows[0];
  }

  async remove(id_job_position_alias: number, options?: QueryOptions) {
    await this.query(options).delete(consultingJobPositionAliasTable).where(eq(consultingJobPositionAliasTable.id_job_position_alias, id_job_position_alias));
  }

  /** Resuelve el puesto del catálogo a partir del texto tal cual de `user.job_position`, o null si no tiene alias todavía. */
  async findByJobPositionTexts(jobPositions: string[], options?: QueryOptions) {
    if (jobPositions.length === 0) return [];
    const rows = await this.query(options).select().from(consultingJobPositionAliasTable);
    const set = new Set(jobPositions);
    return rows.filter((r) => set.has(r.job_position));
  }
}
