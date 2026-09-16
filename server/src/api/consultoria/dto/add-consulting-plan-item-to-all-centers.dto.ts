import { IsInt } from "class-validator";

export class AddConsultingPlanItemToAllCentersDto {
  @IsInt()
  id_catalog_course: number;
}
