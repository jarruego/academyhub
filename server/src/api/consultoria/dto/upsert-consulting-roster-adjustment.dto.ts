import { IsEnum } from "class-validator";
import { ConsultingRosterAdjustmentType } from "src/types/consulting/consulting-roster-adjustment-type.enum";

export class UpsertConsultingRosterAdjustmentDto {
  @IsEnum(ConsultingRosterAdjustmentType)
  adjustment_type: ConsultingRosterAdjustmentType;
}
