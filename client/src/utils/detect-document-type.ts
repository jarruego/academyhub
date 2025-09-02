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