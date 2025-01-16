import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCompanyDTO {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  company_name: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  corporate_name: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  @MaxLength(9)
  cif: string;
}
