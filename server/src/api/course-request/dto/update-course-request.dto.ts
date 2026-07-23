import { IsEmail, IsInt, IsOptional, IsString } from "class-validator";

export class UpdateCourseRequestDto {
  @IsOptional()
  @IsInt()
  id_center?: number | null;

  @IsOptional()
  @IsInt()
  id_course?: number;

  @IsOptional()
  @IsEmail()
  contact_email?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
