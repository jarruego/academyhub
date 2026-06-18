import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsString, IsInt, IsBoolean, IsOptional, IsIn, IsDateString, IsNumberString, IsDate, IsNotEmpty, IsNumber } from "class-validator";
import { CourseModality } from "src/types/course/course-modality.enum";
import { CourseOrigin } from "src/types/course/course-origin.enum";

export class UpdateCourseDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  moodle_id: number;

  @ApiPropertyOptional()
  @IsNotEmpty()
  @IsString()
  course_name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsNotEmpty()
  @IsString()
  short_name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  start_date: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  end_date: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(Object.values(CourseModality)) // Validación de valores permitidos
  modality: CourseModality;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  hours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  price_per_hour: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fundae_id?: string;

  // Nº de expediente INAEM (clave de matching de importación / etiquetado manual).
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  file_number?: string;

  // Origen/financiación del curso (CLIENTE/INAEM/PRIVADO/OTRO).
  @ApiPropertyOptional({ enum: CourseOrigin })
  @IsOptional()
  @IsIn(Object.values(CourseOrigin))
  origin?: CourseOrigin;

  @ApiPropertyOptional({ description: 'Contenidos del curso en HTML', type: String })
  @IsOptional()
  @IsString()
  contents?: string;
}