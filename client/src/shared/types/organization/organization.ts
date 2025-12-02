/** Shared organization types used by client hooks and UI */
export type SettingsMap = Record<string, unknown>;

export type OrganizationSettings = {
  id: number;
  center_id: number;
  /** Free-form settings stored as JSONB */
  settings: SettingsMap;
  logo_path?: string | null;
  signature_path?: string | null;
  version?: number;
  created_at?: string;
  updated_at?: string;
} | null;

export type OrganizationUpsertPayload = {
  settings?: SettingsMap;
  encrypted_secrets?: Record<string, unknown>;
};
