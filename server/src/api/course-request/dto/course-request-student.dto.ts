import { Transform } from "class-transformer";
import { IsOptional, IsString } from "class-validator";
import { normalizeDni, normalizeEmail, normalizePhone, normalizeText } from "../course-request-normalize.util";

/**
 * Ninguno de los campos es estrictamente obligatorio a nivel de validación: se
 * deja guardar la petición aunque falte o sea inválido un dato (nombre, DNI,
 * correo...) — el aviso es solo visual en la grid (en rojo), no bloquea el
 * guardado. Ver `course-request.service.ts#saveStudents`.
 */
export class CourseRequestStudentDto {
  @Transform(({ value }) => normalizeText(value))
  @IsOptional()
  @IsString()
  name?: string;

  @Transform(({ value }) => normalizeText(value))
  @IsOptional()
  @IsString()
  first_surname?: string;

  @Transform(({ value }) => normalizeText(value))
  @IsOptional()
  @IsString()
  second_surname?: string;

  @Transform(({ value }) => normalizeDni(value))
  @IsOptional()
  @IsString()
  dni?: string;

  @Transform(({ value }) => normalizeEmail(value))
  @IsOptional()
  @IsString()
  email?: string;

  @Transform(({ value }) => normalizePhone(value))
  @IsOptional()
  @IsString()
  phone_mobile?: string;
}
