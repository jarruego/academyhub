import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsInt, IsBoolean, IsOptional, IsIn, IsDateString, IsNumberString } from "class-validator";
import { CourseModality } from "src/types/course/course-modality.enum";

export class UpdateCourseDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  moodle_id: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  course_name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  short_name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  start_date: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  end_date: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fundae_id: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(Object.values(CourseModality)) // Validación de valores permitidos
  modality: CourseModality;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  hours: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  price_per_hour: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active: boolean;
}