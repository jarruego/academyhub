import { Type } from "class-transformer";
import { IsInt, Min } from "class-validator";

export class MergeCatalogCourseDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  target_id: number;
}
