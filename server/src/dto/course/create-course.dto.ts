import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNotEmpty, IsString, IsInt, IsBoolean,  IsIn, IsOptional, IsDateString, IsNumberString, IsDate, IsNumber } from "class-validator";
import { CourseModality } from "src/types/course/course-modality.enum";
import { CourseOrigin } from "src/types/course/course-origin.enum";

export class CreateCourseDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  moodle_id: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  course_name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category: string;

  @ApiProperty()
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

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @IsIn(Object.values(CourseModality)) // Validación de valores permitidos
  modality: CourseModality;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  hours: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  price_per_hour: number;

  // Legacy field. The course active state is derived from its groups; kept
  // optional for backward compatibility (defaults to false in the DB).
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fundae_id: string;

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