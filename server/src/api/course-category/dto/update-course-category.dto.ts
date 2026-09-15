import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateCourseCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsInt()
  display_order?: number;
}
