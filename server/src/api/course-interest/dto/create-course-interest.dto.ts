import { Type } from "class-transformer";
import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateIf, ValidateNested } from "class-validator";
import { CourseModality } from "src/types/course/course-modality.enum";
import { InterestSource } from "src/types/course-interest/course-interest.enums";

/** Datos mínimos para dar de alta a un interesado de la nada (sin usuario existente). */
export class NewInterestUserDto {
  @IsNotEmpty() @IsString() name: string;
  @IsOptional() @IsString() first_surname?: string;
  @IsOptional() @IsString() second_surname?: string;
  @IsOptional() @IsString() dni?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() @ValidateIf((o) => o.email !== "") @IsEmail() email?: string;
}

export class CreateCourseInterestDto {
  // Uno de los dos: un usuario existente (`id_user`) o los datos para crear uno nuevo (`new_user`).
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) id_user?: number;
  @Type(() => Number) @IsInt() @Min(1) id_catalog_course: number;
  @IsOptional() @IsEnum(InterestSource) source?: InterestSource;
  @IsOptional() @IsEnum(CourseModality) preferred_modality?: CourseModality;
  @IsOptional() @IsString() availability?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) assigned_to?: number;
  @IsOptional() @ValidateNested() @Type(() => NewInterestUserDto) new_user?: NewInterestUserDto;
}
