
import { IsNumber, IsOptional, IsPositive, IsString, MaxLength } from "class-validator";

export class FilterCompanyDTO {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  id_company?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  company_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  corporate_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(9)
  cif?: string;
}