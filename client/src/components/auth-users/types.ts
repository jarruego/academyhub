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
}
