import { IsEmail, IsInt, IsOptional, IsString } from "class-validator";

export class CreateCourseRequestDto {
  @IsOptional()
  @IsInt()
  id_center?: number;

  @IsInt()
  id_course: number;

  @IsOptional()
  @IsEmail()
  contact_email?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
