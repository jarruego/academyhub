import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CourseRequestStudentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  first_surname: string;

  @IsOptional()
  @IsString()
  second_surname?: string;

  @IsString()
  @IsNotEmpty()
  dni: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone_mobile?: string;
}
