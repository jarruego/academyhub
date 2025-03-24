
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsEmail, IsOptional } from "class-validator";

export class CreateCenterDTO {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  center_name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employer_number: string;

  @ApiProperty()
  @IsNotEmpty()
  id_company: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contact_person: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contact_phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contact_email: string;
}