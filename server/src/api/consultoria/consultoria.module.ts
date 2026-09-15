import { Module } from "@nestjs/common";
import { DatabaseModule } from "src/database/database.module";
import { ConsultingClientController } from "./consultoria-client.controller";
import { ConsultingClientService } from "./consultoria-client.service";
import {
  ConsultingClientRepository,
  ConsultingClientCompanyRepository,
} from "src/database/repository/consultoria/consulting-client.repository";

@Module({
  imports: [DatabaseModule],
  controllers: [ConsultingClientController],
  providers: [ConsultingClientService, ConsultingClientRepository, ConsultingClientCompanyRepository],
  exports: [ConsultingClientService, ConsultingClientRepository, ConsultingClientCompanyRepository],
})
export class ConsultoriaModule {}
