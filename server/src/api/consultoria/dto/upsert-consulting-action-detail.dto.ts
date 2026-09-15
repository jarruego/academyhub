import { IsEnum, IsInt, IsOptional } from "class-validator";
import { ConsultingActionOrigin } from "src/types/consulting/consulting-action-origin.enum";

export class UpsertConsultingActionDetailDto {
  @IsEnum(ConsultingActionOrigin)
  origin: ConsultingActionOrigin;

  @IsOptional()
  @IsInt()
  id_category?: number;

  @IsOptional()
  @IsInt()
  id_planning_date?: number;
}
