import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsOptional, IsString, IsInt, IsDate } from "class-validator";

export class UpdateGroupDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  moodle_id: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  group_name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  id_course: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description: string;

  // @ApiPropertyOptional()
  // @IsOptional()
  // @IsDate()
  // @Type(() => Date)
  // start_date: Date;

  // @ApiPropertyOptional()
  // @IsOptional()
  // @IsDate()
  // @Type(() => Date)
  // end_date: Date;
}
