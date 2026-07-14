/**
 * Modelo tipado de los ajustes de la organización (columna JSONB
 * `organization_settings.settings`).
 *
 * Este fichero es la ÚNICA fuente de verdad de la forma de `settings`:
 * - `OrganizationSettingsData`: el tipo que consumen los servicios.
 * - `DEFAULT_ORGANIZATION_SETTINGS`: defaults aplicados sobre lo guardado.
 * - `normalizeOrganizationSettings()`: convierte el JSONB crudo (posiblemente
 *   legacy o incompleto) al tipo anterior. Todos los consumidores (Moodle,
 *   importador SAGE, informes, certificados) deben pasar por aquí en lugar de
 *   castear el JSON a mano.
 *
 * Los secretos (contraseña FTP/SFTP, token de Moodle) NO forman parte de este
 * modelo: viven cifrados en `encrypted_secrets` (ver organization.service).
 */

import { decryptSecret } from 'src/utils/crypto/secrets.util';

export type MoodleCustomFieldConfig = {
    /** shortname del custom field en Moodle (p. ej. 'DNI') */
    shortname: string;
    /** campo origen en la tabla `user` (p. ej. 'dni') */
    source: string;
};

export type OrganizationContactSettings = {
    name: string;
    email: string;
    phone: string;
};

export type OrganizationCompanySettings = {
    cif: string;
    razon_social: string;
    direccion: string;
    ciudad: string;
    responsable_nombre: string;
    responsable_dni: string;
};

export type OrganizationMoodleSettings = {
    url: string;
    customfields: MoodleCustomFieldConfig[];
};

export type OrganizationFileTransferSettings = {
    type: 'ftp' | 'sftp';
    host: string;
    port: number;
    user: string;
    /** Ruta del fichero en el servidor remoto (p. ej. /datos.7z) */
    path: string;
};

export type OrganizationPluginsSettings = {
    itop_training: boolean;
    configurable_reports: boolean;
    certificates: boolean;
    progress_bar: boolean;
};

export type OrganizationSettingsData = {
    site_name: string;
    contact: OrganizationContactSettings;
    company: OrganizationCompanySettings;
    moodle: OrganizationMoodleSettings;
    file_transfer: OrganizationFileTransferSettings;
    plugins: OrganizationPluginsSettings;
};

export const DEFAULT_ORGANIZATION_SETTINGS: OrganizationSettingsData = {
    site_name: '',
    contact: { name: '', email: '', phone: '' },
    company: {
        cif: '',
        razon_social: '',
        direccion: '',
        ciudad: '',
        responsable_nombre: '',
        responsable_dni: '',
    },
    moodle: { url: '', customfields: [] },
    file_transfer: { type: 'ftp', host: '', port: 21, user: '', path: '' },
    plugins: {
        itop_training: false,
        configurable_reports: false,
        certificates: false,
        progress_bar: false,
    },
};

/** Claves usadas dentro de `encrypted_secrets` para los secretos de la organización. */
export const ORG_SECRET_KEYS = {
    moodleToken: 'moodle_token',
    moodleUrl: 'moodle_url',
    fileTransferPassword: 'file_transfer_password',
} as const;

const asRecord = (v: unknown): Record<string, unknown> =>
    v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const asString = (v: unknown, fallback: string): string =>
    typeof v === 'string' ? v : fallback;

const asBoolean = (v: unknown, fallback: boolean): boolean =>
    typeof v === 'boolean' ? v : fallback;

const asPort = (v: unknown, fallback: number): number => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
    return Number.isInteger(n) && n > 0 && n <= 65535 ? n : fallback;
};

/**
 * Normaliza el JSONB crudo de `settings` al modelo tipado, aplicando defaults
 * campo a campo y tolerando formas legacy:
 * - `moodle_url` / `moodleUrl` en la raíz → `moodle.url`
 * - `moodle_customfields` en la raíz → `moodle.customfields`
 * Nunca lanza: con entrada inválida devuelve los defaults.
 */
export function normalizeOrganizationSettings(raw: unknown): OrganizationSettingsData {
    const s = asRecord(raw);
    const d = DEFAULT_ORGANIZATION_SETTINGS;

    const contact = asRecord(s.contact);
    const company = asRecord(s.company);
    const moodle = asRecord(s.moodle);
    const fileTransfer = asRecord(s.file_transfer);
    const plugins = asRecord(s.plugins);

    const legacyUrl = asString(s.moodle_url, asString(s.moodleUrl, ''));
    const rawCustomFields = Array.isArray(moodle.customfields)
        ? moodle.customfields
        : Array.isArray(s.moodle_customfields) ? s.moodle_customfields : [];

    const customfields: MoodleCustomFieldConfig[] = rawCustomFields
        .map((c) => {
            const r = asRecord(c);
            return {
                shortname: asString(r.shortname, '').trim(),
                source: asString(r.source, '').trim(),
            };
        })
        .filter((c) => c.shortname.length > 0 && c.source.length > 0);

    return {
        site_name: asString(s.site_name, d.site_name),
        contact: {
            name: asString(contact.name, d.contact.name),
            email: asString(contact.email, d.contact.email),
            phone: asString(contact.phone, d.contact.phone),
        },
        company: {
            cif: asString(company.cif, d.company.cif),
            razon_social: asString(company.razon_social, d.company.razon_social),
            direccion: asString(company.direccion, d.company.direccion),
            ciudad: asString(company.ciudad, d.company.ciudad),
            responsable_nombre: asString(company.responsable_nombre, d.company.responsable_nombre),
            responsable_dni: asString(company.responsable_dni, d.company.responsable_dni),
        },
        moodle: {
            url: asString(moodle.url, legacyUrl),
            customfields,
        },
        file_transfer: {
            type: fileTransfer.type === 'sftp' ? 'sftp' : 'ftp',
            host: asString(fileTransfer.host, d.file_transfer.host),
            port: asPort(fileTransfer.port, fileTransfer.type === 'sftp' ? 22 : 21),
            user: asString(fileTransfer.user, d.file_transfer.user),
            path: asString(fileTransfer.path, d.file_transfer.path),
        },
        plugins: {
            itop_training: asBoolean(plugins.itop_training, d.plugins.itop_training),
            configurable_reports: asBoolean(plugins.configurable_reports, d.plugins.configurable_reports),
            certificates: asBoolean(plugins.certificates, d.plugins.certificates),
            progress_bar: asBoolean(plugins.progress_bar, d.plugins.progress_bar),
        },
    };
}

/**
 * Lee un secreto de `encrypted_secrets`: acepta el objeto cifrado
 * (AES-256-GCM) o un string en claro legacy. Devuelve undefined si no existe
 * o no se puede descifrar (nunca lanza).
 */
export function readOrgSecret(encryptedSecrets: unknown, key: string): string | undefined {
    const secrets = asRecord(encryptedSecrets);
    const value = secrets[key];
    if (typeof value === 'string' && value.length > 0) return value; // legacy en claro
    if (value && typeof value === 'object') {
        try {
            return decryptSecret(value);
        } catch {
            return undefined;
        }
    }
    return undefined;
}

/**
 * Contraseña de transferencia en claro en las formas legacy del JSONB
 * (`file_transfer.password` / `sftp.password`). Solo para migración/fallback;
 * las filas nuevas la guardan cifrada en `encrypted_secrets`.
 */
export function readLegacyFileTransferPassword(rawSettings: unknown): string | undefined {
    const s = asRecord(rawSettings);
    for (const container of ['file_transfer', 'sftp']) {
        const obj = asRecord(s[container]);
        const pwd = obj['password'];
        if (typeof pwd === 'string' && pwd.length > 0) return pwd;
    }
    return undefined;
}

/**
 * Línea de "emisor" usada en los PDF de informes y certificados,
 * construida a partir de los datos fiscales. Devuelve '' si no hay datos.
 */
export function buildIssuerLine(company: OrganizationCompanySettings): string {
    const { responsable_nombre, razon_social, cif, direccion } = company;
    if (!responsable_nombre && !razon_social && !cif && !direccion) return '';
    return `${responsable_nombre ? `D. ${responsable_nombre}, ` : ''}${razon_social ? `administrador de ${razon_social}` : ''}${cif ? `, con CIF ${cif}` : ''}${direccion ? ` y domicilio en ${direccion}` : ''}.`;
}
