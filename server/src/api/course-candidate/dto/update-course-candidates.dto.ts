import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { CandidateAttendanceStatus, CandidateEmploymentStatus, CandidateProcessStatus } from "src/types/course-candidate/course-candidate.enums";

export class CourseCandidateUpdateDto {
  @Type(() => Number) @IsInt() @Min(1) id_candidate: number;
  @IsOptional() @IsEnum(CandidateProcessStatus) process_status?: CandidateProcessStatus;
  @IsOptional() @IsEnum(CandidateEmploymentStatus) employment_status?: CandidateEmploymentStatus | null;
  @IsOptional() @IsBoolean() meets_requirements?: boolean | null;
  @IsOptional() @IsEnum(CandidateAttendanceStatus) attendance_status?: CandidateAttendanceStatus;
  @IsOptional() @IsBoolean() has_darde?: boolean;
  @IsOptional() @IsBoolean() has_dni?: boolean;
  @IsOptional() @IsBoolean() has_titulacion?: boolean;
  @IsOptional() @IsString() operational_notes?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) assigned_to?: number | null;
}

export class UpdateCourseCandidatesDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => CourseCandidateUpdateDto)
  candidates: CourseCandidateUpdateDto[];
}
