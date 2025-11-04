export type MoodleUserSelectModel = {
  id_moodle_user: number;
  id_user: number;
  moodle_id: number;
  moodle_username: string;
  moodle_password?: string | null;
  is_main_user?: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
};
