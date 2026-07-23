import { Type } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsPositive } from "class-validator";
import { CourseRequestStatus } from "src/types/course-request/course-request-status.enum";

export class FilterCourseRequestDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @IsOptional()
  id_course?: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @IsOptional()
  id_center?: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @IsOptional()
  id_company?: number;

  @IsIn(Object.values(CourseRequestStatus))
  @IsOptional()
  status?: CourseRequestStatus;
}
