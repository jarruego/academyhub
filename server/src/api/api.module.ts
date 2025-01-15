import { Module } from "@nestjs/common";
import { CompanyModule } from "src/company/company.module";
import { CenterModule } from "src/center/center.module";

@Module({
  imports: [CompanyModule, CenterModule],
})
export class ApiModule {}