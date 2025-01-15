
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsEmail } from "class-validator";

export class CreateCenterDTO {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  center_name: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  employer_number: string;

  @ApiProperty()
  @IsNotEmpty()
  id_company: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  contact_person: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  contact_phone: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsEmail()
  contact_email: string;
}