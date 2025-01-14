import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreateCompanyDTO {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  company_name: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  corporate_name: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(9)
  cif: string;
}
