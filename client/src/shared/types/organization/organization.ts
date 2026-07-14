/**
 * Tipos compartidos de los ajustes de la organización.
 * Espejo del modelo del servidor
 * (`server/src/api/organization/organization-settings.model.ts`): el GET
 * devuelve siempre la forma completa normalizada (defaults aplicados).
 */

export type MoodleCustomFieldConfig = {
  /** shortname del custom field en Moodle (p. ej. 'DNI') */
  shortname: string;
  /** campo origen en la tabla user (p. ej. 'dni') */
  source: string;
};

export type OrganizationSettingsData = {
  site_name: string;
  contact: {
    name: string;
    email: string;
    phone: string;
  };
  company: {
    cif: string;
    razon_social: string;
    direccion: string;
    ciudad: string;
    responsable_nombre: string;
    responsable_dni: string;
  };
  moodle: {
    url: string;
    customfields: MoodleCustomFieldConfig[];
  };
  file_transfer: {
    type: 'ftp' | 'sftp';
    host: string;
    port: number;
    user: string;
    path: string;
  };
  plugins: {
    itop_training: boolean;
    configurable_reports: boolean;
    certificates: boolean;
    progress_bar: boolean;
  };
};

export type OrganizationSettings = {
  id: number;
  center_id: number;
  settings: OrganizationSettingsData;
  logo_path?: string | null;
  signature_path?: string | null;
  version?: number | null;
  created_at?: string;
  updated_at?: string;
  /** Flags de presencia de secretos (los valores nunca viajan al cliente) */
  secrets: {
    has_moodle_token: boolean;
    has_file_transfer_password: boolean;
  };
} | null;

/**
 * Payload del PATCH. `file_transfer.password` es solo de escritura: el
 * servidor la cifra en `encrypted_secrets` y nunca la devuelve; omitirla o
 * enviarla vacía conserva la existente.
 */
export type OrganizationSettingsUpsert = Omit<OrganizationSettingsData, 'file_transfer'> & {
  file_transfer: OrganizationSettingsData['file_transfer'] & { password?: string };
};

export type OrganizationUpsertPayload = {
  settings?: OrganizationSettingsUpsert;
  encrypted_secrets?: Record<string, unknown>;
};
