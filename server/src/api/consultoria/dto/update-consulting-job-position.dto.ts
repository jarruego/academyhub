import { IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateConsultingJobPositionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  id_job_position_group?: number;

  @IsOptional()
  @IsInt()
  display_order?: number;
}
