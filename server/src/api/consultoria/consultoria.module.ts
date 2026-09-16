import { Module } from "@nestjs/common";
import { DatabaseModule } from "src/database/database.module";
import { OrganizationModule } from "src/api/organization/organization.module";
import { ConsultingClientController } from "./consultoria-client.controller";
import { ConsultingClientService } from "./consultoria-client.service";
import { ConsultingPlanningDateController } from "./consultoria-planning-date.controller";
import { ConsultingPlanningDateService } from "./consultoria-planning-date.service";
import { ConsultingActionController } from "./consultoria-action.controller";
import { ConsultingActionService } from "./consultoria-action.service";
import { ConsultingEvaluationController } from "./consultoria-evaluation.controller";
import { ConsultingEvaluationService } from "./consultoria-evaluation.service";
import { ConsultingCuadroController } from "./consultoria-cuadro.controller";
import { ConsultingCuadroService } from "./consultoria-cuadro.service";
import {
  ConsultingClientRepository,
  ConsultingClientCompanyRepository,
} from "src/database/repository/consultoria/consulting-client.repository";
import { ConsultingPlanningDateRepository } from "src/database/repository/consultoria/consulting-planning-date.repository";
import { ConsultingActionDetailRepository } from "src/database/repository/consultoria/consulting-action-detail.repository";
import { ConsultingPlanItemRepository } from "src/database/repository/consultoria/consulting-plan-item.repository";
import { ConsultingAnnualEngagementRepository } from "src/database/repository/consultoria/consulting-annual-engagement.repository";
import { ConsultingEngagementCenterRepository } from "src/database/repository/consultoria/consulting-engagement-center.repository";
import { ConsultingActionEvaluationRepository } from "src/database/repository/consultoria/consulting-action-evaluation.repository";
import { ConsultingRosterAdjustmentRepository } from "src/database/repository/consultoria/consulting-roster-adjustment.repository";
import { ConsultingActionAttendeeRepository } from "src/database/repository/consultoria/consulting-action-attendee.repository";
import { ConsultingCuadroRepository } from "src/database/repository/consultoria/consulting-cuadro.repository";
import { CenterRepository } from "src/database/repository/center/center.repository";
import { CourseRepository } from "src/database/repository/course/course.repository";

@Module({
  imports: [DatabaseModule, OrganizationModule],
  controllers: [
    ConsultingClientController,
    ConsultingPlanningDateController,
    ConsultingActionController,
    ConsultingEvaluationController,
    ConsultingCuadroController,
  ],
  providers: [
    ConsultingClientService,
    ConsultingClientRepository,
    ConsultingClientCompanyRepository,
    ConsultingPlanningDateService,
    ConsultingPlanningDateRepository,
    ConsultingActionService,
    ConsultingActionDetailRepository,
    ConsultingPlanItemRepository,
    ConsultingAnnualEngagementRepository,
    ConsultingEngagementCenterRepository,
    ConsultingEvaluationService,
    ConsultingActionEvaluationRepository,
    ConsultingCuadroService,
    ConsultingRosterAdjustmentRepository,
    ConsultingActionAttendeeRepository,
    ConsultingCuadroRepository,
    CenterRepository,
    CourseRepository,
  ],
  exports: [
    ConsultingClientService,
    ConsultingClientRepository,
    ConsultingClientCompanyRepository,
    ConsultingPlanningDateService,
    ConsultingPlanningDateRepository,
    ConsultingActionService,
    ConsultingActionDetailRepository,
    ConsultingPlanItemRepository,
    ConsultingAnnualEngagementRepository,
    ConsultingEngagementCenterRepository,
    ConsultingEvaluationService,
    ConsultingActionEvaluationRepository,
    ConsultingCuadroService,
    ConsultingRosterAdjustmentRepository,
    ConsultingActionAttendeeRepository,
    ConsultingCuadroRepository,
  ],
})
export class ConsultoriaModule {}
