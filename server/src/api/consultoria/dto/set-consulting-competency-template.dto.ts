import { IsBoolean, IsOptional } from "class-validator";

export class SetConsultingCompetencyTemplateDto {
  // true = no necesita mejorar, false = necesita mejorar, ausente/null = no aplica a este puesto.
  @IsOptional()
  @IsBoolean()
  default_value?: boolean | null;
}
