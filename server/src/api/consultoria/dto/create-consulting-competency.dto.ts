import { IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class CreateConsultingCompetencyDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsInt()
  display_order?: number;
}
