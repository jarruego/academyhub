import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsInt, IsEmail, IsBoolean, IsIn, IsOptional, IsDate, IsDateString} from "class-validator";
import { DocumentType } from "src/types/user/document-type.enum";
import { Gender } from "src/types/user/gender.enum";


export class CreateUserDTO {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  first_surname: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  second_surname: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  dni: string; // TODO: DNI is not mandatory, but if provided, it must be unique

  @ApiProperty()
  @IsNotEmpty()
  @IsIn(Object.values(DocumentType))
  document_type: DocumentType;

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
  @IsDateString()
  registration_date: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birth_date: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nss: string;

  @ApiProperty()
  @IsOptional()
  @IsIn(Object.values(Gender))
  gender: Gender;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  professional_category: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  salary_group: number;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  seasonalWorker: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  erteLaw: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accreditationDiploma: string;
}
