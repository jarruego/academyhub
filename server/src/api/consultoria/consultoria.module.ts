import { Module } from "@nestjs/common";
import { DatabaseModule } from "src/database/database.module";
import { ConsultingClientController } from "./consultoria-client.controller";
import { ConsultingClientService } from "./consultoria-client.service";
import { ConsultingPlanningDateController } from "./consultoria-planning-date.controller";
import { ConsultingPlanningDateService } from "./consultoria-planning-date.service";
import { ConsultingActionController } from "./consultoria-action.controller";
import { ConsultingActionService } from "./consultoria-action.service";
import {
  ConsultingClientRepository,
  ConsultingClientCompanyRepository,
} from "src/database/repository/consultoria/consulting-client.repository";
import { ConsultingPlanningDateRepository } from "src/database/repository/consultoria/consulting-planning-date.repository";
import { ConsultingActionDetailRepository } from "src/database/repository/consultoria/consulting-action-detail.repository";

@Module({
  imports: [DatabaseModule],
  controllers: [ConsultingClientController, ConsultingPlanningDateController, ConsultingActionController],
  providers: [
    ConsultingClientService,
    ConsultingClientRepository,
    ConsultingClientCompanyRepository,
    ConsultingPlanningDateService,
    ConsultingPlanningDateRepository,
    ConsultingActionService,
    ConsultingActionDetailRepository,
  ],
  exports: [
    ConsultingClientService,
    ConsultingClientRepository,
    ConsultingClientCompanyRepository,
    ConsultingPlanningDateService,
    ConsultingPlanningDateRepository,
    ConsultingActionService,
    ConsultingActionDetailRepository,
  ],
})
export class ConsultoriaModule {}
