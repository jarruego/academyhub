import { IsBoolean, IsOptional } from "class-validator";

export class SetConsultingCompetencyEvaluationDto {
  // true = no necesita mejorar, false = necesita mejorar, ausente/null = no aplica a este trabajador.
  @IsOptional()
  @IsBoolean()
  value?: boolean | null;
}
