import { MoodleUser } from "src/types/moodle/user";
import { isValidDocument } from "src/utils/dni.util";

/** Campos de un usuario de Moodle que participan en el matching por DNI. */
export type MoodleUserMatchSource = Pick<MoodleUser, "username" | "customfields">;

/** Forma canónica de un documento tal como se guarda en `users.dni` (compacto, mayúsculas). */
export function compactDniKey(raw: string | null | undefined): string {
    return String(raw ?? "").trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/**
 * Variantes de DNI de un usuario de Moodle para buscar en la BD local: el
 * customfield `dni` y el `username` cuando valida como DNI/NIE, cada uno en
 * crudo y normalizado (mayúsculas/minúsculas sin separadores), porque
 * `users.dni` se guarda en mayúsculas compacto y Moodle devuelve minúsculas.
 */
export function moodleUserDniVariants(moodleUser: MoodleUserMatchSource): string[] {
    const variants: string[] = [];
    const push = (raw: unknown) => {
        const trimmed = String(raw ?? '').trim();
        if (!trimmed) return;
        const compact = trimmed.replace(/[^a-zA-Z0-9]/g, '');
        variants.push(trimmed, compact.toUpperCase(), compact.toLowerCase());
    };

    const dniField = moodleUser.customfields?.find(f => (f.shortname && f.shortname.toLowerCase() === 'dni') || (f.name && f.name.toLowerCase() === 'dni'));
    if (dniField?.value) push(dniField.value);
    if (isValidDocument(moodleUser.username)) push(moodleUser.username);

    return [...new Set(variants.filter(v => v.length > 0))];
}

/**
 * Claves canónicas (compacto-mayúsculas) del DNI de un usuario de Moodle, para
 * cruces en memoria contra un mapa de `users.dni` normalizado. Mismo origen que
 * `moodleUserDniVariants` (customfield `dni` primero, luego `username` válido).
 */
export function moodleUserDniKeys(moodleUser: MoodleUserMatchSource): string[] {
    const keys: string[] = [];
    const dniField = moodleUser.customfields?.find(f => (f.shortname && f.shortname.toLowerCase() === 'dni') || (f.name && f.name.toLowerCase() === 'dni'));
    if (dniField?.value) {
        const key = compactDniKey(dniField.value);
        if (key) keys.push(key);
    }
    if (isValidDocument(moodleUser.username)) {
        const key = compactDniKey(moodleUser.username);
        if (key) keys.push(key);
    }
    return [...new Set(keys)];
}

/**
 * DNI a guardar en un usuario local recién creado desde Moodle: solo cuando el
 * `username` es un documento válido, normalizado como se guarda en la BD.
 */
export function moodleUserDniToStore(moodleUser: MoodleUserMatchSource): string | null {
    const compact = compactDniKey(moodleUser.username);
    return isValidDocument(compact) ? compact : null;
}
