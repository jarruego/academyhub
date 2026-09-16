import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { Repository, QueryOptions } from "../repository";
import {
  consultingActionAttendeeTable,
  ConsultingActionAttendeeInsertModel,
} from "src/database/schema/tables/consulting_action_attendee.table";
import { userTable } from "src/database/schema/tables/user.table";
import { catalogCourseTable } from "src/database/schema/tables/course.table";

const JOINED_COLUMNS = {
  id_action_attendee: consultingActionAttendeeTable.id_action_attendee,
  id_catalog_course: consultingActionAttendeeTable.id_catalog_course,
  action_name: catalogCourseTable.name,
  id_center: consultingActionAttendeeTable.id_center,
  id_annual_engagement: consultingActionAttendeeTable.id_annual_engagement,
  id_user: consultingActionAttendeeTable.id_user,
  name: userTable.name,
  first_surname: userTable.first_surname,
  second_surname: userTable.second_surname,
  dni: userTable.dni,
  job_position: userTable.job_position,
  attended_at: consultingActionAttendeeTable.attended_at,
};

@Injectable()
export class ConsultingActionAttendeeRepository extends Repository {
  private baseQuery(options?: QueryOptions) {
    return this.query(options)
      .select(JOINED_COLUMNS)
      .from(consultingActionAttendeeTable)
      .innerJoin(userTable, eq(consultingActionAttendeeTable.id_user, userTable.id_user))
      .innerJoin(catalogCourseTable, eq(consultingActionAttendeeTable.id_catalog_course, catalogCourseTable.id_catalog_course));
  }

  /** Asistentes de una acción, en un centro, dentro de una consultoría concreta. */
  async findByCenterAndCatalogCourse(id_center: number, id_catalog_course: number, id_annual_engagement: number, options?: QueryOptions) {
    return this.baseQuery(options).where(and(
      eq(consultingActionAttendeeTable.id_center, id_center),
      eq(consultingActionAttendeeTable.id_catalog_course, id_catalog_course),
      eq(consultingActionAttendeeTable.id_annual_engagement, id_annual_engagement),
    ));
  }

  async findById(id_action_attendee: number, options?: QueryOptions) {
    const rows = await this.baseQuery(options).where(eq(consultingActionAttendeeTable.id_action_attendee, id_action_attendee));
    return rows[0];
  }

  async add(data: ConsultingActionAttendeeInsertModel, options?: QueryOptions) {
    const rows = await this.query(options).insert(consultingActionAttendeeTable).values(data).returning();
    return this.findById(rows[0].id_action_attendee, options);
  }

  async remove(id_action_attendee: number, options?: QueryOptions) {
    await this.query(options).delete(consultingActionAttendeeTable).where(eq(consultingActionAttendeeTable.id_action_attendee, id_action_attendee));
  }
}
