import { IsArray, IsIn, IsOptional, IsString } from "class-validator";
import { MERGEABLE_FIELDS } from "../user-merge.util";

/**
 * Cuerpo de POST /user-merge/:winnerId/:loserId.
 * Los IDs van en la ruta (para que queden registrados en `audit_log`).
 * `fieldsFromLoser` = campos escalares cuyo valor debe tomarse de la ficha
 * perdedora (por defecto el ganador es autoritativo). Validado contra la
 * whitelist MERGEABLE_FIELDS.
 */
export class MergeUsersDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(MERGEABLE_FIELDS as unknown as string[], { each: true })
  fieldsFromLoser?: string[];
}
