export interface AuthUser {
  id: number;
  name: string;
  lastName?: string;
  email: string;
  username: string;
  password?: string;
  role: string;
  moodleToken?: string; // <-- Añadido aquí
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
  moodleToken?: string; // <-- Añadido aquí
}
