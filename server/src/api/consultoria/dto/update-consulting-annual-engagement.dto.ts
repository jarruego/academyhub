import { IsEnum } from "class-validator";
import { ConsultingEngagementStatus } from "src/types/consulting/consulting-engagement-status.enum";

export class UpdateConsultingAnnualEngagementDto {
  // Cerrar o reabrir — solo estos dos, gestión manual.
  @IsEnum(ConsultingEngagementStatus)
  status: ConsultingEngagementStatus;
}
