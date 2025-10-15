// Tipos base equivalentes a los modelos de Drizzle
export interface UserCourseSelectModel {
  id_user: number;
  id_course: number;
  id_moodle_user: number | null;
  enrollment_date: string | null;
  completion_percentage: string | null;
  time_spent: number | null;
}

export interface CourseSelectModel {
  id_course: number;
  moodle_id: number | null;
  course_name: string;
  category: string | null;
  short_name: string;
  start_date: string | null;
  end_date: string | null;
  modality: string;
  hours: number | null;
  price_per_hour: number | null;
  active: boolean;
  fundae_id: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Tipo compuesto para el resultado del JOIN
export type UserCourseWithCourse = UserCourseSelectModel & {
  course: CourseSelectModel;
};