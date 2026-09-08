import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class VerifyPasswordDTO {
  @ApiProperty()
  @MaxLength(128)
  @IsNotEmpty()
  @IsString()
  password: string;
}
