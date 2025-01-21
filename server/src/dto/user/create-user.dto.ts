import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsInt, IsEmail, IsBoolean, IsIn, IsOptional, IsDate, IsDateString} from "class-validator";
// import { DocumentType } from "src/types/user/document-type.enum";
// import { Gender } from "src/types/user/gender.enum";


export class CreateUserDTO {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  surname: string;

  // @ApiProperty()
  // @IsNotEmpty()
  // @IsString()
  // dni: string;

  // @ApiProperty()
  // @IsNotEmpty()
  // @IsIn(Object.values(DocumentType))
  // document_type?: DocumentType;

  @ApiProperty()
  @IsOptional()
  @IsEmail()
  email: string;

  // @ApiProperty()
  // @IsOptional()
  // @IsString()
  // phone: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  moodle_username: string;

  // @ApiProperty()
  // @IsOptional()
  // @IsString()
  // moodle_password: string;

  @ApiProperty()
  @IsOptional()
  @IsInt()
  moodle_id: number;

  // @ApiProperty()
  // @IsOptional()
  // @IsDateString()
  // registration_date: Date;

  // @ApiProperty()
  // @IsOptional()
  // @IsString()
  // nss: string;

  // @ApiProperty()
  // @IsOptional()
  // @IsIn(Object.values(Gender))
  // gender?: Gender;

  // @ApiProperty()
  // @IsOptional()
  // @IsString()
  // professional_category: string;

  // @ApiProperty()
  // @IsOptional()
  // @IsBoolean()
  // disability: boolean;

  // @ApiProperty()
  // @IsOptional()
  // @IsBoolean()
  // terrorism_victim: boolean;

  // @ApiProperty()
  // @IsOptional()
  // @IsBoolean()
  // gender_violence_victim: boolean;

  // @ApiProperty()
  // @IsOptional()
  // @IsString()
  // education_level: string;

  // @ApiProperty()
  // @IsOptional()
  // @IsString()
  // address: string;

  // @ApiProperty()
  // @IsOptional()
  // @IsString()
  // postal_code: string;

  // @ApiProperty()
  // @IsOptional()
  // @IsString()
  // city: string;

  // @ApiProperty()
  // @IsOptional()
  // @IsString()
  // province: string;

  // @ApiProperty()
  // @IsOptional()
  // @IsString()
  // country: string;

  // @ApiProperty()
  // @IsOptional()
  // @IsString()
  // observations: string;
}
