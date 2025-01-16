
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsEmail, IsOptional } from "class-validator";

export class CreateCenterDTO {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  center_name: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  employer_number: string;

  @ApiProperty()
  @IsNotEmpty()
  id_company: number;

  @ApiProperty()
  @IsOptional()
  @IsString()
  contact_person: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  contact_phone: string;

  @ApiProperty()
  @IsOptional()
  @IsEmail()
  contact_email: string;
}