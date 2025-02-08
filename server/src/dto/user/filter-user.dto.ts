import { IsOptional, IsString, IsInt, IsEmail, IsBoolean, IsIn, IsDateString } from "class-validator";
//import { DocumentType } from "src/types/user/document-type.enum";
//import { Gender } from "src/types/user/gender.enum";

export class FilterUserDTO {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  first_surname?: string;

  @IsOptional()
  @IsString()
  second_surname?: string;

  @IsOptional()
  @IsString()
  dni?: string;

  // @IsOptional()
  // @IsIn(Object.values(DocumentType))
  // document_type?: DocumentType;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  moodle_username?: string;

  @IsOptional()
  @IsInt()
  moodle_id?: number;

  // @IsOptional()
  // @IsDateString()
  // registration_date?: Date;

  // @IsOptional()
  // @IsString()
  // nss?: string;

  // @IsOptional()
  // @IsIn(Object.values(Gender))
  // gender?: Gender;

  // @IsOptional()
  // @IsString()
  // professional_category?: string;

  // @IsOptional()
  // @IsBoolean()
  // disability?: boolean;

  // @IsOptional()
  // @IsBoolean()
  // terrorism_victim?: boolean;

  // @IsOptional()
  // @IsBoolean()
  // gender_violence_victim?: boolean;

  // @IsOptional()
  // @IsString()
  // education_level?: string;

  // @IsOptional()
  // @IsString()
  // address?: string;

  // @IsOptional()
  // @IsString()
  // postal_code?: string;

  // @IsOptional()
  // @IsString()
  // city?: string;

  // @IsOptional()
  // @IsString()
  // province?: string;

  // @IsOptional()
  // @IsString()
  // country?: string;

  // @IsOptional()
  // @IsString()
  // observations?: string;
}
