import { IsIn, IsNotEmpty, IsString } from "class-validator";
import { SanitizableField } from "../user-sanitization.util";

const FIELDS: SanitizableField[] = ["phone", "email", "dni", "nss"];

/**
 * Cuerpo de POST /user-sanitization/:id/manual. Permite corregir a mano
 * cualquier campo (incluido `dni`, que no es auto-corregible). El valor se
 * valida/normaliza en el servidor.
 */
export class ManualFixDto {
  @IsIn(FIELDS as unknown as string[])
  field: SanitizableField;

  @IsString()
  @IsNotEmpty()
  value: string;
}
