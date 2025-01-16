import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNotEmpty, IsString, IsInt, IsEmail, IsBoolean, IsIn, IsOptional, IsDate} from "class-validator";

export class CreateUserDTO {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  surname: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  dni: string;

  @ApiProperty()
  @IsOptional()
  @IsIn(['NIF', 'NIE'])
  document_type: string;

  @ApiProperty()
  @IsOptional()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  phone: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  moodle_username: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  moodle_password: string;

  @ApiProperty()
  @IsOptional()
  @IsInt()
  moodle_id: number;

  @ApiProperty()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  registration_date: Date;

  @ApiProperty()
  @IsOptional()
  @IsString()
  nss: string;

  @ApiProperty()
  @IsOptional()
  @IsIn(['Male', 'Female', 'Other'])
  gender: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  professional_category: string;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  disability: boolean;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  terrorism_victim: boolean;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  gender_violence_victim: boolean;

  @ApiProperty()
  @IsOptional()
  @IsString()
  education_level: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  address: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  postal_code: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  city: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  province: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  country: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  observations: string;
}
