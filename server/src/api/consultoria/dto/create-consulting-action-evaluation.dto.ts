import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateConsultingActionEvaluationDto {
  @IsInt()
  id_catalog_course: number;

  @IsDateString()
  evaluation_date: string;

  @IsOptional()
  @IsString()
  evaluation_text?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  percentage?: number;

  @IsOptional()
  @IsString()
  imparte_text?: string;
}
