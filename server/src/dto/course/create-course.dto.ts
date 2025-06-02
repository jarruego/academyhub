import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNotEmpty, IsString, IsInt, IsBoolean,  IsIn, IsOptional, IsDateString, IsNumberString, IsDate, IsNumber } from "class-validator";
import { CourseModality } from "src/types/course/course-modality.enum";

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

  @ApiProperty()
  @IsNotEmpty()
  @IsBoolean()
  active: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fundae_id: string;
}