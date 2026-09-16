import { IsInt } from "class-validator";

export class AddConsultingEngagementCenterDto {
  @IsInt()
  id_center: number;
}
