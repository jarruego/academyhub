/**
 * Validación del documento de identidad español (DNI / NIE) por su letra de
 * control. Portado de `client/src/utils/detect-document-type.ts` (el backend no
 * podía importar del cliente). Solo valida la letra: no normaliza ni inventa
 * dato (un documento mal tecleado no es auto-corregible).
 *
 *   - DNI: 8 dígitos + letra; letra = "TRWAGMYFPDXBNJZSQVHLCKE"[nº % 23].
 *   - NIE: [XYZ] + 7 dígitos + letra; la inicial mapea X→0, Y→1, Z→2 y luego
 *     se aplica el mismo algoritmo del DNI.
 */

const CONTROL_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

function validateDniLetter(dni: string): boolean {
  const dniNumber = parseInt(dni.slice(0, 8), 10);
  return CONTROL_LETTERS[dniNumber % 23] === dni[8].toUpperCase();
}

function validateNieLetter(nie: string): boolean {
  const map: Record<string, string> = { X: "0", Y: "1", Z: "2" };
  const numericPart = map[nie[0].toUpperCase()] + nie.slice(1, 8);
  return CONTROL_LETTERS[parseInt(numericPart, 10) % 23] === nie[8].toUpperCase();
}

/** true si el valor es un DNI o NIE con letra de control correcta. */
export function isValidDocument(dni: string | null | undefined): boolean {
  if (!dni) return false;
  const upper = String(dni).trim().toUpperCase();
  if (/^[XYZ]\d{7}[A-Z]$/.test(upper)) return validateNieLetter(upper);
  if (/^\d{8}[A-Z]$/.test(upper)) return validateDniLetter(upper);
  return false;
}
