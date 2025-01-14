import { Module } from "@nestjs/common";
import { CompanyModule } from "src/company/company.module";

@Module({
  imports: [CompanyModule],
})
export class ApiModule {}