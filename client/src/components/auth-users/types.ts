export interface AuthUser {
  id: number;
  name: string;
  lastName?: string;
  email: string;
  username: string;
  password?: string;
  role: string;
  /** true si tiene algún vínculo Moodle (los vínculos siempre llevan token) */
  has_moodle_token?: boolean;
  /** Permiso puntual, independiente del rol: gestión de candidaturas de una edición (Planificación y selección + Candidatos, incluye importar Preinscritos INAEM). */
  can_manage_candidates?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export type AuthUserFormValues = {
  username: string;
  password?: string;
  email: string;
  name: string;
  lastName?: string;
  role?: string;
  can_manage_candidates?: boolean;
}
