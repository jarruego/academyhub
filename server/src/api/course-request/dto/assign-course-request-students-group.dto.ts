import { Type } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsInt, Min } from "class-validator";

export class AssignCourseRequestStudentsGroupDto {
  @IsInt()
  @Type(() => Number)
  id_group: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Type(() => Number)
  studentIds: number[];
}
