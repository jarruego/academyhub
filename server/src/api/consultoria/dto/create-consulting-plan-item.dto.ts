import { IsInt, IsOptional } from "class-validator";

export class CreateConsultingPlanItemDto {
  // Ausente/null = plan base, compartido por todos los centros del cliente.
  @IsOptional()
  @IsInt()
  id_center?: number | null;

  @IsInt()
  id_catalog_course: number;
}
