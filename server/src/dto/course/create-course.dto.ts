import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsInt, IsDate, IsEnum, IsBoolean, IsDecimal, IsIn } from "class-validator";

export class CreateCourseDTO {
  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  moodle_id: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  course_name: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  category: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  short_name: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDate()
  start_date: Date;

  @ApiProperty()
  @IsNotEmpty()
  @IsDate()
  end_date: Date;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  fundae_id: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @IsIn(['Online', 'Presential']) // Validación de valores permitidos
  modality: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  hours: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsDecimal()
  price_per_hour: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsBoolean()
  active: boolean;
}