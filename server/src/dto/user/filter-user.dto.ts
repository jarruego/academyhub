import { IsOptional, IsString, IsInt, IsEmail, IsBoolean, IsIn, IsDateString, IsNotEmpty } from "class-validator";
import { DocumentType } from "src/types/user/document-type.enum";
import { Gender } from "src/types/user/gender.enum";

export class FilterUserDTO {
  @IsOptional()
  @IsInt()
  id_user: number;

  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  first_surname?: string;

  @IsOptional()
  @IsString()
  second_surname?: string;

  @IsOptional()
  @IsString()
  dni?: string;

  @IsOptional()
  @IsIn(Object.values(DocumentType))
  document_type?: DocumentType;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsDateString()
  registration_date?: Date;

  @IsOptional()
  @IsString()
  nss?: string;

  @IsOptional()
  @IsIn(Object.values(Gender))
  gender?: Gender;

  @IsOptional()
  @IsString()
  professional_category?: string;

  @IsOptional()
  @IsInt()
  salary_group?: number;

  @IsOptional()
  @IsBoolean()
  disability?: boolean;

  @IsOptional()
  @IsBoolean()
  terrorism_victim?: boolean;

  @IsOptional()
  @IsBoolean()
  gender_violence_victim?: boolean;

  @IsOptional()
  @IsString()
  education_level?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  postal_code?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
  @IsBoolean()
  seasonalWorker: boolean;

  @IsOptional()
  @IsBoolean()
  erteLaw: boolean;

  @IsOptional()
  @IsString()
  accreditationDiploma: string;  
}
