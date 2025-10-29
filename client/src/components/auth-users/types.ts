export interface AuthUser {
  id: number;
  name: string;
  lastName?: string | null;
  email: string;
  username: string;
  role: string;
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
