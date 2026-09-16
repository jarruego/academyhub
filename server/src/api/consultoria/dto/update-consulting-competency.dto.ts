import { IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateConsultingCompetencyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  display_order?: number;
}
