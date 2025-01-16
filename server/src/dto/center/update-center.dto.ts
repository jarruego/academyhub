import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsEmail, IsOptional, IsNumber } from "class-validator";

export class UpdateCenterDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  center_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employer_number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  id_company?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contact_person?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contact_phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contact_email?: string;
}