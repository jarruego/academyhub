import { Transform, Type } from "class-transformer";
import { IsArray, IsInt, IsNumber, IsOptional, IsPositive } from "class-validator";

/**
 * Convierte el valor de un query param a array de enteros positivos, admitiendo
 * tanto una repetición (`id_company=1&id_company=2` -> ['1','2'] vía qs) como un
 * único valor suelto (`id_company=1` -> '1'). Vacío/ausente -> undefined (para
 * que @IsOptional() lo salte).
 */
function toPositiveIntArray({ value }: { value: unknown }): number[] | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const raw = Array.isArray(value) ? value : [value];
  const nums = raw.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0);
  return nums.length ? nums : undefined;
}

export class CourseRequestReportFilterDto {
  // Admite varias empresas a la vez (selección múltiple en el cliente).
  @Transform(toPositiveIntArray)
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  id_company?: number[];

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @IsOptional()
  id_center?: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @IsOptional()
  id_course?: number;
}
