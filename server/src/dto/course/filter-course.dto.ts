import { Type } from "class-transformer";
import { IsOptional, IsString, IsInt, IsBoolean, IsDateString, IsIn, IsNumber, isNumberString, IsNumberString, IsDate } from "class-validator";
import { CourseModality } from "src/types/course/course-modality.enum";

export class FilterCourseDTO {
  @IsOptional()
  @IsInt()
  moodle_id?: number;

  @IsOptional()
  @IsString()
  course_name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  short_name?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  start_date?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  end_date?: Date;

  @IsOptional()
  @IsString()
  @IsIn(Object.values(CourseModality)) // Validación de valores permitidos
  modality?: CourseModality;

  @IsOptional()
  @IsInt()
  hours?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  price_per_hour?: number;

  @IsOptional()
  @IsString()
  fundae_id?: string;
}
