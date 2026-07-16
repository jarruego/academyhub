export type MoodleUserSelectModel = {
  id_moodle_user: number;
  id_user: number;
  moodle_id: number;
  moodle_username: string;
  moodle_password?: string | null;
  is_main_user?: boolean;
  /** Espejo del estado en Moodle (lo escribe la Auditoría de Moodle al sincronizar). */
  suspended?: boolean;
  /** Fecha en que se detectó que la cuenta ya no existe en Moodle (lápida); null = viva. */
  deleted_in_moodle_at?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};
