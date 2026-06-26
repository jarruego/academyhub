import { IsIn } from "class-validator";
import { AUTO_FIXABLE_FIELDS, AutoFixableField } from "../user-sanitization.util";

/**
 * Cuerpo de POST /user-sanitization/:id/fix.
 * El campo a corregir va validado contra la whitelist de campos
 * auto-corregibles (el servidor recalcula y aplica el valor saneado).
 */
export class FixIssueDto {
  @IsIn(AUTO_FIXABLE_FIELDS as unknown as string[])
  field: AutoFixableField;
}
