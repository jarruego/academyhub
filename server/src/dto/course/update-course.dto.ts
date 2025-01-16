
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsInt, IsDate, IsEnum, IsBoolean, IsDecimal, IsOptional } from "class-validator";

export class UpdateCourseDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  moodle_id: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  course_name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  short_name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  start_date: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  end_date: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fundae_id: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(['Online', 'Presential'])
  modality: 'Online' | 'Presential';

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  hours: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal()
  price_per_hour: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active: boolean;
}