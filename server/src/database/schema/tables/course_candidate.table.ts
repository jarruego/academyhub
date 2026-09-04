import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { boolean, index, integer, serial, text, uniqueIndex } from "drizzle-orm/pg-core";
import { academyhubSchema } from "../pg-schema";
import { authUserTable } from "./auth_user.table";
import { courseTable } from "./course.table";
import { courseInterestTable } from "./course_interest.table";
import { TIMESTAMPS } from "./timestamps";
import { userTable } from "./user.table";
import {
  CandidateAttendanceStatus,
  CandidateEmploymentStatus,
  CandidateProcessStatus,
  CandidateSource,
} from "../../../types/course-candidate/course-candidate.enums";

export const candidateSource = academyhubSchema.enum("candidate_source", Object.values(CandidateSource) as [string, ...string[]]);
export const candidateProcessStatus = academyhubSchema.enum("candidate_process_status", Object.values(CandidateProcessStatus) as [string, ...string[]]);
export const candidateEmploymentStatus = academyhubSchema.enum("candidate_employment_status", Object.values(CandidateEmploymentStatus) as [string, ...string[]]);
export const candidateAttendanceStatus = academyhubSchema.enum("candidate_attendance_status", Object.values(CandidateAttendanceStatus) as [string, ...string[]]);

export const courseCandidateTable = academyhubSchema.table("course_candidates", {
  id_candidate: serial().primaryKey(),
  id_user: integer().notNull().references(() => userTable.id_user),
  id_course: integer().notNull().references(() => courseTable.id_course),
  source: candidateSource().notNull().default(CandidateSource.MANUAL),
  // Interés del que procede esta candidatura (fase 3), si la hay. Se rellena
  // al "incorporar a edición" y también, retroactivamente, cuando se
  // descarta/cierra una candidatura sin interés previo y se crea uno nuevo
  // para no perder a la persona de cara a la siguiente convocatoria.
  id_interest: integer().references(() => courseInterestTable.id_interest, { onDelete: "set null" }),
  // Estado de selección/proceso: único campo, PENDIENTE/SELECCIONADA/NO_SELECCIONADA
  // (antes había un `selection_status` separado y redundante, se fusionaron).
  process_status: candidateProcessStatus().notNull().default(CandidateProcessStatus.PENDING),
  employment_status: candidateEmploymentStatus(),
  meets_requirements: boolean(),
  // Confirmación de asistencia a la prueba de selección previa al curso.
  attendance_status: candidateAttendanceStatus().notNull().default(CandidateAttendanceStatus.PENDING),
  // Documentación aportada: 3 documentos independientes (antes un único
  // `documentation_status` que no permitía saber cuál faltaba).
  has_darde: boolean().notNull().default(false),
  has_dni: boolean().notNull().default(false),
  has_titulacion: boolean().notNull().default(false),
  operational_notes: text(),
  assigned_to: integer().references(() => authUserTable.id),
  created_by: integer().references(() => authUserTable.id),
  ...TIMESTAMPS,
}, (table) => ({
  userCourseUnique: uniqueIndex("idx_course_candidates_user_course").on(table.id_user, table.id_course),
  courseIdx: index("idx_course_candidates_id_course").on(table.id_course),
  processStatusIdx: index("idx_course_candidates_process_status").on(table.process_status),
  assignedToIdx: index("idx_course_candidates_assigned_to").on(table.assigned_to),
  interestIdx: index("idx_course_candidates_id_interest").on(table.id_interest),
}));

export type CourseCandidateSelectModel = InferSelectModel<typeof courseCandidateTable>;
export type CourseCandidateInsertModel = InferInsertModel<typeof courseCandidateTable>;
export type CourseCandidateUpdateModel = Partial<CourseCandidateInsertModel>;
