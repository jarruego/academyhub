import { describe, it, expect } from 'vitest';
import { detectDocumentType } from './detect-document-type';
// Ajusta la ruta si es necesario
import { DocumentType } from '../shared/types/user/document-type.enum';

describe('detectDocumentType', () => {
  // Casos válidos y con letra correcta
  it('debería detectar un DNI válido con letra correcta', () => {
    expect(detectDocumentType('12345678Z')).toBe(DocumentType.DNI); // 12345678Z es válido
  });

  it('debería detectar un NIE válido con letra correcta', () => {
    expect(detectDocumentType('X1234567L')).toBe(DocumentType.NIE); // X1234567L es válido
    expect(detectDocumentType('Y1234567X')).toBe(DocumentType.NIE); // Y1234567X es válido
    expect(detectDocumentType('Z1234567R')).toBe(DocumentType.NIE); // Z1234567R es válido
  });

  it('debería devolver undefined para DNI con letra incorrecta', () => {
    expect(detectDocumentType('12345678A')).toBeUndefined(); // Letra incorrecta
  });

  it('debería devolver undefined para NIE con letra incorrecta', () => {
    expect(detectDocumentType('X1234567A')).toBeUndefined(); // Letra incorrecta
    expect(detectDocumentType('Y1234567A')).toBeUndefined(); // Letra incorrecta
    expect(detectDocumentType('Z1234567A')).toBeUndefined(); // Letra incorrecta
  });

  it('debería devolver undefined para documento inválido', () => {
    expect(detectDocumentType('1234')).toBeUndefined();
    expect(detectDocumentType('A1234567L')).toBeUndefined();
    expect(detectDocumentType('')).toBeUndefined();
    expect(detectDocumentType(undefined as unknown as string)).toBeUndefined();
  });
});
