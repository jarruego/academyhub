import { IsInt, IsString, MinLength } from "class-validator";

export class UpsertConsultingJobPositionAliasDto {
  @IsString()
  @MinLength(1)
  job_position: string;

  @IsInt()
  id_job_position: number;
}
