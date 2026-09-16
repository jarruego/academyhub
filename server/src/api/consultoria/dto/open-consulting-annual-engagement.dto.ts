import { IsArray, IsInt, IsOptional, Min } from "class-validator";

export class OpenConsultingAnnualEngagementDto {
  @IsInt()
  @Min(2000)
  year: number;

  // Ausente = todos los centros del cliente (por defecto).
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  id_centers?: number[];
}
