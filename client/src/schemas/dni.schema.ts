import z from "zod";

const dniRegex = /^[0-9]{8}[A-Za-z]$/;
const nieRegex = /^[XYZ][0-9]{7}[A-Za-z]$/i;
const dniLetters = "TRWAGMYFPDXBNJZSQVHLCKE";

const toDniNumber = (value: string): number | null => {
  const upper = value.toUpperCase();
  if (dniRegex.test(upper)) {
    return parseInt(upper.slice(0, 8), 10);
  }
  if (nieRegex.test(upper)) {
    const prefix = upper[0];
    const mapped = prefix === 'X' ? '0' : prefix === 'Y' ? '1' : '2';
    return parseInt(mapped + upper.slice(1, 8), 10);
  }
  return null;
};

export const DNI_SCHEMA = z
  .string()
  .regex(new RegExp(`${dniRegex.source}|${nieRegex.source}`, 'i'), {
    message: "El DNI/NIE debe tener formato válido (ej. 12345678Z o X1234567L)",
  })
  .refine((value) => {
    const number = toDniNumber(value);
    if (number == null) return false;
    const letter = value.slice(-1).toUpperCase();
    return dniLetters[number % 23] === letter;
  }, { message: "La letra del DNI/NIE no es válida" });