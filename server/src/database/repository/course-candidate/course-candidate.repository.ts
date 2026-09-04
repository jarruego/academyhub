import { Injectable } from "@nestjs/common";
import { and, asc, count, eq, getTableColumns } from "drizzle-orm";
import { authUserTable } from "src/database/schema/tables/auth_user.table";
import { courseCandidateTable, CourseCandidateInsertModel, CourseCandidateUpdateModel } from "src/database/schema/tables/course_candidate.table";
import { userPreinscriptionTable } from "src/database/schema/tables/user_preinscription.table";
import { userTable } from "src/database/schema/tables/user.table";
import { QueryOptions, Repository } from "../repository";

@Injectable()
export class CourseCandidateRepository extends Repository {
  async findByCourse(idCourse: number, options?: QueryOptions) {
    return this.query(options)
      .select({
        ...getTableColumns(courseCandidateTable),
        name: userTable.name,
        first_surname: userTable.first_surname,
        second_surname: userTable.second_surname,
        dni: userTable.dni,
        phone: userTable.phone,
        email: userTable.email,
        inaem_status: userPreinscriptionTable.status,
        prioritaria: userPreinscriptionTable.prioritaria,
        preinscription_date: userPreinscriptionTable.preinscription_date,
        registration_source: userPreinscriptionTable.registration_source,
        registered_at: userPreinscriptionTable.registered_at,
        verified_at: userPreinscriptionTable.verified_at,
        last_imported_at: userPreinscriptionTable.last_imported_at,
        assigned_to_username: authUserTable.username,
      })
      .from(courseCandidateTable)
      .innerJoin(userTable, eq(courseCandidateTable.id_user, userTable.id_user))
      .leftJoin(userPreinscriptionTable, and(
        eq(userPreinscriptionTable.id_user, courseCandidateTable.id_user),
        eq(userPreinscriptionTable.id_course, courseCandidateTable.id_course),
      ))
      .leftJoin(authUserTable, eq(courseCandidateTable.assigned_to, authUserTable.id))
      .where(eq(courseCandidateTable.id_course, idCourse))
      .orderBy(asc(userTable.first_surname), asc(userTable.name));
  }

  async findById(idCandidate: number, options?: QueryOptions) {
    const [row] = await this.query(options).select().from(courseCandidateTable).where(eq(courseCandidateTable.id_candidate, idCandidate));
    return row;
  }

  async findByUserCourse(idUser: number, idCourse: number, options?: QueryOptions) {
    const [row] = await this.query(options).select().from(courseCandidateTable).where(and(
      eq(courseCandidateTable.id_user, idUser),
      eq(courseCandidateTable.id_course, idCourse),
    ));
    return row;
  }

  async upsert(data: CourseCandidateInsertModel, options?: QueryOptions) {
    const [inserted] = await this.query(options)
      .insert(courseCandidateTable)
      .values(data)
      .onConflictDoNothing({ target: [courseCandidateTable.id_user, courseCandidateTable.id_course] })
      .returning();
    return inserted ?? this.findByUserCourse(data.id_user, data.id_course, options);
  }

  async update(idCandidate: number, data: CourseCandidateUpdateModel, options?: QueryOptions) {
    const [row] = await this.query(options)
      .update(courseCandidateTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(courseCandidateTable.id_candidate, idCandidate))
      .returning();
    return row;
  }

  async countByCourse(idCourse: number, options?: QueryOptions) {
    const [row] = await this.query(options).select({ value: count() }).from(courseCandidateTable).where(eq(courseCandidateTable.id_course, idCourse));
    return Number(row?.value ?? 0);
  }

  async delete(idCandidate: number, options?: QueryOptions) {
    const [row] = await this.query(options).delete(courseCandidateTable)
      .where(eq(courseCandidateTable.id_candidate, idCandidate)).returning();
    return row;
  }
}
