import { Module } from "@nestjs/common";
import { DatabaseModule } from "src/database/database.module";
import { ImportController } from "./import.controller";
import { ImportService } from "./import.service";
import { JobService } from "./job.service";

@Module({
    imports: [DatabaseModule],
    controllers: [ImportController],
    providers: [ImportService, JobService],
    exports: [ImportService, JobService]
})
export class ImportModule {}