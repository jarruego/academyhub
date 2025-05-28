import z from "zod";

const dniRegex = /^[0-9]{8}[A-Za-z]$/;
const dniLetters = "TRWAGMYFPDXBNJZSQVHLCKE";

export const DNI_SCHEMA = z
  .string()
  .regex(dniRegex, { message: "El DNI debe tener 8 números y una letra (ej. 12345678Z)" })
  .refine((dni) => {
    const number = parseInt(dni.slice(0, 8), 10);
    const letter = dni.slice(-1).toUpperCase();
    return dniLetters[number % 23] === letter;
  }, { message: "La letra del DNI no es válida" });