import { Type } from "class-transformer";
import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateIf, ValidateNested } from "class-validator";
import { CandidateSource } from "src/types/course-candidate/course-candidate.enums";

/** Datos mínimos para crear un candidato de la nada (sin usuario existente). */
export class NewCandidateUserDto {
  @IsNotEmpty() @IsString() name: string;
  @IsOptional() @IsString() first_surname?: string;
  @IsOptional() @IsString() second_surname?: string;
  @IsOptional() @IsString() dni?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() @ValidateIf((o) => o.email !== "") @IsEmail() email?: string;
}

export class CreateCourseCandidateDto {
  // Uno de los dos: un usuario existente (`id_user`) o los datos para crear uno nuevo (`new_user`).
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) id_user?: number;
  @Type(() => Number) @IsInt() @Min(1) id_course: number;
  @IsOptional() @IsEnum(CandidateSource) source?: CandidateSource;
  @IsOptional() @ValidateNested() @Type(() => NewCandidateUserDto) new_user?: NewCandidateUserDto;
}
