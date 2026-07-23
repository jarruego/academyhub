import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsPositive } from "class-validator";

export class CourseRequestReportFilterDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @IsOptional()
  id_company?: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @IsOptional()
  id_center?: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @IsOptional()
  id_course?: number;
}
