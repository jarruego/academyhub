import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsInt, IsBoolean, IsOptional, IsIn, IsNumber, IsDateString } from "class-validator";

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
  @IsDateString()
  start_date: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  end_date: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fundae_id: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['Online', 'Presential']) // Validación de valores permitidos
  modality: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  hours: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  price_per_hour: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active: boolean;
}