import { DocumentType } from "../shared/types/user/document-type.enum";

export function detectDocumentType(dni: string): DocumentType | undefined {
  if (!dni) return undefined;
  const upper = dni.toUpperCase();
  if (/^[XYZ]\d{7}[A-Z]$/.test(upper)) return DocumentType.NIE;
  if (/^\d{8}[A-Z]$/.test(upper)) return DocumentType.DNI;
  return undefined;
}
