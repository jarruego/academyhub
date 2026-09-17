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
import { ConsultingPlanController } from "./consultoria-plan.controller";
import { ConsultingPlanService } from "./consultoria-plan.service";
import { ConsultingCompetencyController } from "./consultoria-competency.controller";
import { ConsultingCompetencyService } from "./consultoria-competency.service";
import { ConsultingJobPositionController } from "./consultoria-job-position.controller";
import { ConsultingJobPositionService } from "./consultoria-job-position.service";
import { ConsultingJobPositionGroupController } from "./consultoria-job-position-group.controller";
import { ConsultingJobPositionGroupService } from "./consultoria-job-position-group.service";
import { ConsultingJobPositionAliasController } from "./consultoria-job-position-alias.controller";
import { ConsultingJobPositionAliasService } from "./consultoria-job-position-alias.service";
import { ConsultingCompetencyTemplateController } from "./consultoria-competency-template.controller";
import { ConsultingCompetencyTemplateService } from "./consultoria-competency-template.service";
import { ConsultingCompetencyEvaluationController } from "./consultoria-competency-evaluation.controller";
import { ConsultingCompetencyEvaluationService } from "./consultoria-competency-evaluation.service";
import { ConsultingCatalogSeedController } from "./consultoria-catalog-seed.controller";
import { ConsultingCatalogSeedService } from "./consultoria-catalog-seed.service";
import { ConsultingCenterTokenController } from "./consultoria-center-token.controller";
import { ConsultingCenterTokenService } from "./consultoria-center-token.service";
import { ConsultingCentroController } from "./consultoria-centro.controller";
import { ConsultingCentroService } from "./consultoria-centro.service";
import { ConsultingTokenGuard } from "src/guards/auth/consulting-token.guard";
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
import { ConsultingCompetencyRepository } from "src/database/repository/consultoria/consulting-competency.repository";
import { ConsultingJobPositionRepository } from "src/database/repository/consultoria/consulting-job-position.repository";
import { ConsultingJobPositionGroupRepository } from "src/database/repository/consultoria/consulting-job-position-group.repository";
import { ConsultingJobPositionAliasRepository } from "src/database/repository/consultoria/consulting-job-position-alias.repository";
import { ConsultingPositionCompetencyTemplateRepository } from "src/database/repository/consultoria/consulting-position-competency-template.repository";
import { ConsultingCompetencyEvaluationRepository } from "src/database/repository/consultoria/consulting-competency-evaluation.repository";
import { ConsultingCenterTokenRepository } from "src/database/repository/consultoria/consulting-center-token.repository";
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
    ConsultingPlanController,
    ConsultingCompetencyController,
    ConsultingJobPositionController,
    ConsultingJobPositionGroupController,
    ConsultingJobPositionAliasController,
    ConsultingCompetencyTemplateController,
    ConsultingCompetencyEvaluationController,
    ConsultingCatalogSeedController,
    ConsultingCenterTokenController,
    ConsultingCentroController,
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
    ConsultingPlanService,
    ConsultingCompetencyService,
    ConsultingCompetencyRepository,
    ConsultingJobPositionService,
    ConsultingJobPositionRepository,
    ConsultingJobPositionGroupService,
    ConsultingJobPositionGroupRepository,
    ConsultingJobPositionAliasService,
    ConsultingJobPositionAliasRepository,
    ConsultingCompetencyTemplateService,
    ConsultingPositionCompetencyTemplateRepository,
    ConsultingCompetencyEvaluationService,
    ConsultingCompetencyEvaluationRepository,
    ConsultingCatalogSeedService,
    ConsultingCenterTokenService,
    ConsultingCenterTokenRepository,
    ConsultingCentroService,
    ConsultingTokenGuard,
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
    ConsultingPlanService,
    ConsultingCompetencyService,
    ConsultingCompetencyRepository,
    ConsultingJobPositionService,
    ConsultingJobPositionRepository,
    ConsultingJobPositionGroupService,
    ConsultingJobPositionGroupRepository,
    ConsultingJobPositionAliasService,
    ConsultingJobPositionAliasRepository,
    ConsultingCompetencyTemplateService,
    ConsultingPositionCompetencyTemplateRepository,
    ConsultingCompetencyEvaluationService,
    ConsultingCompetencyEvaluationRepository,
  ],
})
export class ConsultoriaModule {}
