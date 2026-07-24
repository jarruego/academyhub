import { IsDateString, IsEmail, IsInt, IsOptional, IsString } from "class-validator";

export class CreateCourseRequestDto {
  @IsOptional()
  @IsInt()
  id_center?: number;

  @IsInt()
  id_course: number;

  // Fecha de la petición (yyyy-mm-dd). Si se omite, el servidor usa la fecha de alta.
  @IsOptional()
  @IsDateString()
  request_date?: string;

  @IsOptional()
  @IsEmail()
  contact_email?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
