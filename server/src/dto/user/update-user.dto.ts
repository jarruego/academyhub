import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsOptional, IsString, IsInt, IsEmail, IsBoolean, IsIn, IsDate } from "class-validator";

export class UpdateUserDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  surname: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dni: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['NIF', 'NIE'])
  document_type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  moodle_username: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  moodle_password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  moodle_id: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  registration_date: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nss: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['Male', 'Female', 'Other'])
  gender: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  professional_category: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  disability: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  terrorism_victim: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  gender_violence_victim: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  education_level: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postal_code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  province: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations: string;
}
