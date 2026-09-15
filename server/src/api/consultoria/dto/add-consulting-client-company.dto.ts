import { IsInt } from "class-validator";

export class AddConsultingClientCompanyDto {
  @IsInt()
  id_company: number;
}
