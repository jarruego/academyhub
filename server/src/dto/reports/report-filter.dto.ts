import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsInt, IsString, IsDateString, IsArray, IsBoolean, IsEnum } from "class-validator";
import { Type, Transform } from "class-transformer";
import { CourseModality } from "src/types/course/course-modality.enum";
import { CourseClient } from "src/types/course/course-client.enum";
import { CourseFunding } from "src/types/course/course-funding.enum";

export class ReportFilterDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  id_company?: number[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  id_center?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_course?: number;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  id_group?: number[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  id_role?: number[];

  @ApiPropertyOptional({ type: String, description: 'Search across name, dni and email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ type: String, description: 'Start date (ISO) to filter group start_date >= start_date' })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional({ type: String, description: 'End date (ISO) to filter group end_date <= end_date' })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({ type: String, description: 'Field to sort by (column key)' })
  @IsOptional()
  @IsString()
  sort_field?: string;

  @ApiPropertyOptional({ type: String, description: 'Sort order: asc or desc' })
  @IsOptional()
  @IsString()
  sort_order?: 'asc' | 'desc';

  @ApiPropertyOptional({ type: Number, description: 'Completion percentage threshold (inclusive). Rows with completion >= this value will be returned' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  completion_percentage?: number;

  @ApiPropertyOptional({ type: Boolean, description: 'Si es true, sólo devuelve inscripciones marcadas como bonificadas (user_group.bonified = true)' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  bonified?: boolean;

  @ApiPropertyOptional({ enum: CourseModality, isArray: true, description: 'Filtra por modalidad del curso' })
  @IsOptional()
  @IsArray()
  @IsEnum(CourseModality, { each: true })
  modality?: CourseModality[];

  @ApiPropertyOptional({ enum: CourseClient, isArray: true, description: 'Filtra por cliente/comitente del curso' })
  @IsOptional()
  @IsArray()
  @IsEnum(CourseClient, { each: true })
  client?: CourseClient[];

  @ApiPropertyOptional({ enum: CourseFunding, isArray: true, description: 'Filtra por financiación del curso' })
  @IsOptional()
  @IsArray()
  @IsEnum(CourseFunding, { each: true })
  funding?: CourseFunding[];
}
