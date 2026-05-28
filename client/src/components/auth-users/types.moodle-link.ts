export interface MoodleUserAuthUserLink {
  id: number;
  id_moodle_user: number;
  id_auth_user: number;
  moodle_token: string;
  createdAt: string;
  updatedAt: string;
  // Opcional: datos del usuario de moodle (si se hace join en backend)
  moodle_user?: {
    id_moodle_user: number;
    moodle_id: number;
    moodle_username: string;
  };
}
