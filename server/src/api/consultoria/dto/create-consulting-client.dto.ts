import { IsString, MinLength } from "class-validator";

export class CreateConsultingClientDto {
  @IsString()
  @MinLength(1)
  name: string;
}
