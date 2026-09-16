import { Injectable } from "@nestjs/common";
import { eq, and, or, isNull, lte, gte } from "drizzle-orm";
import { Repository, QueryOptions } from "../repository";
import {
  consultingRosterAdjustmentTable,
} from "src/database/schema/tables/consulting_roster_adjustment.table";
import { userTable } from "src/database/schema/tables/user.table";
import { userCenterTable } from "src/database/schema/tables/user_center.table";
import { ConsultingRosterAdjustmentType } from "src/types/consulting/consulting-roster-adjustment-type.enum";

const USER_COLUMNS = {
  id_user: userTable.id_user,
  name: userTable.name,
  first_surname: userTable.first_surname,
  second_surname: userTable.second_surname,
  dni: userTable.dni,
  job_position: userTable.job_position,
};

@Injectable()
export class ConsultingRosterAdjustmentRepository extends Repository {
  /**
   * Trabajadores realmente asociados al centro (`user_center`) y activos en
   * algún momento del año dado — solapan [1-ene, 31-dic] de ese año. Una baja
   * dentro de ese mismo año entra; una baja anterior, no.
   */
  async findRealMembers(id_center: number, year: number, options?: QueryOptions) {
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);
    return this.query(options)
      .select(USER_COLUMNS)
      .from(userCenterTable)
      .innerJoin(userTable, eq(userCenterTable.id_user, userTable.id_user))
      .where(and(
        eq(userCenterTable.id_center, id_center),
        or(isNull(userCenterTable.start_date), lte(userCenterTable.start_date, yearEnd)),
        or(isNull(userCenterTable.end_date), gte(userCenterTable.end_date, yearStart)),
      ));
  }

  async findAdjustments(id_center: number, id_annual_engagement: number, options?: QueryOptions) {
    return this.query(options)
      .select({ ...USER_COLUMNS, adjustment_type: consultingRosterAdjustmentTable.adjustment_type, id_roster_adjustment: consultingRosterAdjustmentTable.id_roster_adjustment })
      .from(consultingRosterAdjustmentTable)
      .innerJoin(userTable, eq(consultingRosterAdjustmentTable.id_user, userTable.id_user))
      .where(and(eq(consultingRosterAdjustmentTable.id_center, id_center), eq(consultingRosterAdjustmentTable.id_annual_engagement, id_annual_engagement)));
  }

  async upsert(id_center: number, id_user: number, id_annual_engagement: number, adjustment_type: ConsultingRosterAdjustmentType, created_by: number | undefined, options?: QueryOptions) {
    await this.query(options)
      .insert(consultingRosterAdjustmentTable)
      .values({ id_center, id_user, id_annual_engagement, adjustment_type, created_by })
      .onConflictDoUpdate({
        target: [consultingRosterAdjustmentTable.id_center, consultingRosterAdjustmentTable.id_user, consultingRosterAdjustmentTable.id_annual_engagement],
        set: { adjustment_type, updatedAt: new Date() },
      });
  }

  async remove(id_roster_adjustment: number, options?: QueryOptions) {
    await this.query(options).delete(consultingRosterAdjustmentTable).where(eq(consultingRosterAdjustmentTable.id_roster_adjustment, id_roster_adjustment));
  }
}
