import { Module } from "@nestjs/common";
import { CompanyModule } from "src/api/company/company.module";
import { CenterModule } from "src/api/center/center.module";

@Module({
  imports: [CompanyModule, CenterModule],
})
export class ApiModule {}