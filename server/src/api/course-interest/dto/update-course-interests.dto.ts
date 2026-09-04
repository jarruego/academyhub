import { Type } from "class-transformer";
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { CourseModality } from "src/types/course/course-modality.enum";
import { InterestSource, InterestStatus } from "src/types/course-interest/course-interest.enums";

export class CourseInterestUpdateDto {
  @Type(() => Number) @IsInt() @Min(1) id_interest: number;
  @IsOptional() @IsEnum(InterestStatus) status?: InterestStatus;
  @IsOptional() @IsEnum(InterestSource) source?: InterestSource | null;
  @IsOptional() @IsEnum(CourseModality) preferred_modality?: CourseModality | null;
  @IsOptional() @IsString() availability?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) assigned_to?: number | null;
}

export class UpdateCourseInterestsDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => CourseInterestUpdateDto)
  interests: CourseInterestUpdateDto[];
}
