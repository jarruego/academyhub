import { IsArray, IsInt, IsOptional } from "class-validator";

export class FixUsernamesDto {
  /** Vínculos concretos a corregir; si se omite, se corrigen todos los desactualizados. */
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  idMoodleUsers?: number[];
}
