/**
 * Valida un número de la Seguridad Social española
 * 
 * @param {string} nss - Número de SS de 12 dígitos
 * @returns {boolean} true si es válido, false si no lo es
 * 
 * @example
 * validateNSS('281234567840') // true
 * validateNSS('281234567841') // false
 */
export function validateNSS(nss: string): boolean {
  // Limpiar el string de caracteres no numéricos
  const cleanNSS = String(nss).replace(/[^0-9]/g, '');
  // Validar longitud
  if (cleanNSS.length !== 12) {
    return false;
  }
  // Descomponer el número
  const provincia = cleanNSS.substring(0, 2);
  const afiliado = cleanNSS.substring(2, 10);
  const control = cleanNSS.substring(10, 12);
  // Convertir a números
  const numProvincia = parseInt(provincia, 10);
  const numAfiliado = parseInt(afiliado, 10);
  const numControl = parseInt(control, 10);
  // Calcular el número base según el algoritmo
  let numeroBase;
  if (numAfiliado < 10000000) {
    // Si el número de afiliado es menor de 10 millones
    numeroBase = numAfiliado + numProvincia * 10000000;
  } else {
    // Si el número de afiliado es mayor o igual a 10 millones
    numeroBase = parseInt(provincia + afiliado, 10);
  }
  // El dígito de control debe ser el resto de dividir numeroBase entre 97
  const digitoEsperado = numeroBase % 97;
  return digitoEsperado === numControl;
}
import { DocumentType } from "../shared/types/user/document-type.enum";

function validateDniLetter(dni: string): boolean {
  const dniNumber = parseInt(dni.slice(0, 8), 10);
  const dniLetter = dni[8].toUpperCase();
  const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
  return letters[dniNumber % 23] === dniLetter;
}

function validateNieLetter(nie: string): boolean {
  const map = { X: '0', Y: '1', Z: '2' } as const;
  const firstChar = nie[0].toUpperCase();
  const numericPart = map[firstChar as keyof typeof map] + nie.slice(1, 8);
  const nieLetter = nie[8].toUpperCase();
  const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
  return letters[parseInt(numericPart, 10) % 23] === nieLetter;
}

export function detectDocumentType(dni: string): DocumentType | undefined {
  if (!dni) return undefined;
  const upper = dni.toUpperCase();

  if (/^[XYZ]\d{7}[A-Z]$/.test(upper) && validateNieLetter(upper)) {
    return DocumentType.NIE;
  }

  if (/^\d{8}[A-Z]$/.test(upper) && validateDniLetter(upper)) {
    return DocumentType.DNI;
  }

  return undefined;
}