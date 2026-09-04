import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";
import { CourseModality } from "src/types/course/course-modality.enum";
import { InterestSource } from "src/types/course-interest/course-interest.enums";

export class CreateCourseInterestDto {
  @Type(() => Number) @IsInt() @Min(1) id_user: number;
  @Type(() => Number) @IsInt() @Min(1) id_catalog_course: number;
  @IsOptional() @IsEnum(InterestSource) source?: InterestSource;
  @IsOptional() @IsEnum(CourseModality) preferred_modality?: CourseModality;
  @IsOptional() @IsString() availability?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) assigned_to?: number;
}
