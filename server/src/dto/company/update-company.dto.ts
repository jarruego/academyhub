import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, MaxLength } from "class-validator";

export class UpdateCompanyDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  company_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  corporate_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(9)
  cif?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  import_id?: string;
}