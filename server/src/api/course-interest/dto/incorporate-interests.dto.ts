import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, Min } from "class-validator";

export class IncorporateInterestsDto {
  @Type(() => Number) @IsInt() @Min(1) id_course: number;
  @IsArray() @ArrayMinSize(1) @Type(() => Number) @IsInt({ each: true })
  interest_ids: number[];
}
