import { IsBoolean, IsDateString, IsEmail, IsInt, IsOptional, IsString } from "class-validator";

export class UpdateCourseRequestDto {
  @IsOptional()
  @IsInt()
  id_center?: number | null;

  @IsOptional()
  @IsInt()
  id_course?: number;

  // Fecha de la petición (yyyy-mm-dd). Editable a mano tras el alta.
  @IsOptional()
  @IsDateString()
  request_date?: string;

  @IsOptional()
  @IsEmail()
  contact_email?: string | null;

  @IsOptional()
  @IsBoolean()
  is_urgent?: boolean;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
