import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class CreateCourseCategoryDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsInt()
  display_order?: number;
}
