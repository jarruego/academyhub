import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsInt, IsBoolean,  IsIn, IsNumber, IsOptional, IsDateString } from "class-validator";

export class CreateCourseDTO {
  @ApiProperty()
  @IsOptional()
  @IsInt()
  moodle_id: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  course_name: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  category: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  short_name: string;

  @ApiProperty()
  @IsOptional()
  @IsDateString()
  start_date: Date;

  @ApiProperty()
  @IsOptional()
  @IsDateString()
  end_date: Date;

  @ApiProperty()
  @IsOptional()
  @IsString()
  fundae_id: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @IsIn(['Online', 'Presential']) // Validación de valores permitidos
  modality: string;

  @ApiProperty()
  @IsOptional()
  @IsInt()
  hours: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  price_per_hour: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsBoolean()
  active: boolean;
}