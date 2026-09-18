import { Module } from "@nestjs/common";
import { DatabaseModule } from "src/database/database.module";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";
import { SearchRepository } from "src/database/repository/search/search.repository";

@Module({
  imports: [DatabaseModule],
  controllers: [SearchController],
  providers: [SearchService, SearchRepository],
})
export class SearchModule {}
