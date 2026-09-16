import { IsDateString, IsInt } from "class-validator";

export class CreateConsultingActionAttendeeDto {
  @IsInt()
  id_catalog_course: number;

  @IsInt()
  id_user: number;

  @IsDateString()
  attended_at: string;
}
