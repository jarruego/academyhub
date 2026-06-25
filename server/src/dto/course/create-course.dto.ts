import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNotEmpty, IsString, IsInt, IsBoolean,  IsIn, IsOptional, IsDateString, IsNumberString, IsDate, IsNumber } from "class-validator";
import { CourseModality } from "src/types/course/course-modality.enum";
import { CourseClient } from "src/types/course/course-client.enum";
import { CourseFunding } from "src/types/course/course-funding.enum";

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

  // Cliente/comitente del curso (INAEM/VITALIA/OTRO). El ámbito se deriva de funding.
  @ApiPropertyOptional({ enum: CourseClient })
  @IsOptional()
  @IsIn(Object.values(CourseClient))
  client?: CourseClient;

  // Financiación del curso: ¿cómo se paga? (PRIVADA/FUNDAE/PUBLICA).
  @ApiPropertyOptional({ enum: CourseFunding })
  @IsOptional()
  @IsIn(Object.values(CourseFunding))
  funding?: CourseFunding;

  @ApiPropertyOptional({ description: 'Contenidos del curso en HTML', type: String })
  @IsOptional()
  @IsString()
  contents?: string;
}