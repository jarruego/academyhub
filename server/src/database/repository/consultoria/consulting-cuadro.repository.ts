import { Injectable } from "@nestjs/common";
import { and, eq, gte, lte } from "drizzle-orm";
import { Repository, QueryOptions } from "../repository";
import { userTable } from "src/database/schema/tables/user.table";
import { userGroupTable } from "src/database/schema/tables/user_group.table";
import { groupTable } from "src/database/schema/tables/group.table";
import { courseTable } from "src/database/schema/tables/course.table";

const JOINED_COLUMNS = {
  id_user: userTable.id_user,
  name: userTable.name,
  first_surname: userTable.first_surname,
  second_surname: userTable.second_surname,
  dni: userTable.dni,
  job_position: userTable.job_position,
  id_course: courseTable.id_course,
  finalized: userGroupTable.finalized,
  attended_at: userGroupTable.join_date,
};

@Injectable()
export class ConsultingCuadroRepository extends Repository {
  /**
   * Matrícula real (grupo/edición) de un curso de catálogo, para los alumnos
   * matriculados desde este centro (`user_group.id_center`) — no el centro
   * "de casa" del trabajador (`user_center`), sino desde el que se
   * matriculó en esa edición concreta. Acotado al año auditado
   * (`user_group.join_date`), igual que el resto del cuadro. Solo lectura:
   * esto nunca se toca desde Consultoría, ver docs/consultoria.md.
   */
  async findRealAttendance(id_center: number, id_catalog_course: number, year: number, options?: QueryOptions) {
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);
    return this.query(options)
      .select(JOINED_COLUMNS)
      .from(userGroupTable)
      .innerJoin(userTable, eq(userGroupTable.id_user, userTable.id_user))
      .innerJoin(groupTable, eq(userGroupTable.id_group, groupTable.id_group))
      .innerJoin(courseTable, eq(groupTable.id_course, courseTable.id_course))
      .where(and(
        eq(userGroupTable.id_center, id_center),
        eq(courseTable.id_catalog_course, id_catalog_course),
        gte(userGroupTable.join_date, yearStart),
        lte(userGroupTable.join_date, yearEnd),
      ));
  }
}
