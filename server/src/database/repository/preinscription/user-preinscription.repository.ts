import { Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { Repository, QueryOptions } from "../repository";
import { userPreinscriptionTable } from "src/database/schema/tables/user_preinscription.table";
import { userTable } from "src/database/schema/tables/user.table";
import { courseTable } from "src/database/schema/tables/course.table";
import { PreinscriptionStatus } from "src/types/preinscription/preinscription-status.enum";

@Injectable()
export class UserPreinscriptionRepository extends Repository {
  /** Preinscripciones de un curso/expediente, con datos básicos del usuario. */
  async findByCourse(id_course: number, options?: QueryOptions) {
    return this.query(options)
      .select({
        id_user: userPreinscriptionTable.id_user,
        id_course: userPreinscriptionTable.id_course,
        status: userPreinscriptionTable.status,
        prioritaria: userPreinscriptionTable.prioritaria,
        preinscription_date: userPreinscriptionTable.preinscription_date,
        name: userTable.name,
        first_surname: userTable.first_surname,
        second_surname: userTable.second_surname,
        dni: userTable.dni,
        email: userTable.email,
      })
      .from(userPreinscriptionTable)
      .innerJoin(userTable, eq(userPreinscriptionTable.id_user, userTable.id_user))
      .where(eq(userPreinscriptionTable.id_course, id_course));
  }

  /** Preinscripciones de un usuario (para la ficha de usuario), con datos del curso. */
  async findByUser(id_user: number, options?: QueryOptions) {
    return this.query(options)
      .select({
        id_course: userPreinscriptionTable.id_course,
        status: userPreinscriptionTable.status,
        prioritaria: userPreinscriptionTable.prioritaria,
        preinscription_date: userPreinscriptionTable.preinscription_date,
        course_name: courseTable.course_name,
        file_number: courseTable.file_number,
        origin: courseTable.origin,
        // Finalización de la matrícula (user_group) en ese curso:
        // true = algún grupo finalizado, false = matriculado sin finalizar,
        // null = sin matrícula (no hay datos de finalización).
        finalized: sql<boolean | null>`(
          SELECT bool_or(ug.finalized)
          FROM user_group ug
          JOIN groups g ON g.id_group = ug.id_group
          WHERE ug.id_user = ${userPreinscriptionTable.id_user}
            AND g.id_course = ${userPreinscriptionTable.id_course}
        )`,
      })
      .from(userPreinscriptionTable)
      .innerJoin(courseTable, eq(userPreinscriptionTable.id_course, courseTable.id_course))
      .where(eq(userPreinscriptionTable.id_user, id_user));
  }

  /** Inserta o actualiza una preinscripción (clave id_user+id_course). */
  async upsert(
    data: {
      id_user: number;
      id_course: number;
      status?: PreinscriptionStatus;
      prioritaria?: boolean;
      preinscription_date?: Date | null;
    },
    options?: QueryOptions,
  ) {
    const set: Record<string, unknown> = {};
    if (data.prioritaria !== undefined) set.prioritaria = data.prioritaria;
    if (data.preinscription_date !== undefined) set.preinscription_date = data.preinscription_date;
    // El estado NO se degrada en conflicto (preserva MATRICULADO); sólo se fuerza
    // explícitamente desde el servicio cuando procede (ver markEnrolled).
    return this.query(options)
      .insert(userPreinscriptionTable)
      .values({
        id_user: data.id_user,
        id_course: data.id_course,
        status: data.status ?? PreinscriptionStatus.PREINSCRITO,
        prioritaria: data.prioritaria ?? false,
        preinscription_date: data.preinscription_date ?? null,
      })
      .onConflictDoUpdate({
        target: [userPreinscriptionTable.id_user, userPreinscriptionTable.id_course],
        set,
      });
  }

  /** Marca como MATRICULADO (crea la fila si no existía). */
  async markEnrolled(id_user: number, id_course: number, options?: QueryOptions) {
    return this.query(options)
      .insert(userPreinscriptionTable)
      .values({ id_user, id_course, status: PreinscriptionStatus.MATRICULADO })
      .onConflictDoUpdate({
        target: [userPreinscriptionTable.id_user, userPreinscriptionTable.id_course],
        set: { status: PreinscriptionStatus.MATRICULADO },
      });
  }

  /** Actualiza el estado de una preinscripción concreta (uso manual). */
  async updateStatus(
    id_user: number,
    id_course: number,
    status: PreinscriptionStatus,
    options?: QueryOptions,
  ) {
    return this.query(options)
      .update(userPreinscriptionTable)
      .set({ status })
      .where(
        and(
          eq(userPreinscriptionTable.id_user, id_user),
          eq(userPreinscriptionTable.id_course, id_course),
        ),
      );
  }
}
