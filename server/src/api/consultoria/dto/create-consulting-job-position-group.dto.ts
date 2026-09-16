import { IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class CreateConsultingJobPositionGroupDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsInt()
  display_order?: number;
}
