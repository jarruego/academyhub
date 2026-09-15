import { IsOptional, IsString, MinLength } from "class-validator";

export class UpdateConsultingClientDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
