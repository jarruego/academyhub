import z from "zod";

// Expresión regular para validar formato básico de CIF español
const cifRegex = /^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$/i;

export const CIF_SCHEMA = z
  .string()
  .regex(cifRegex, { message: "El CIF debe tener un formato válido (ej. B12345678)" })
  // Puedes añadir aquí más validaciones/refinamientos si necesitas comprobar el dígito de control
;