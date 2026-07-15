import { Transform } from "class-transformer";
import { IsBoolean, IsOptional } from "class-validator";

export class DeleteCourseDTO {
  // Confirma el borrado en cascada de las matrículas (user_course) del curso.
  // Llega por query string, de ahí el Transform (no hay booleanos nativos en la URL).
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  deleteEnrollments?: boolean;
}
