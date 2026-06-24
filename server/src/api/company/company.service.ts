import { Inject, Injectable } from "@nestjs/common";
import { CompanyRepository } from "src/database/repository/company/company.repository";
import { CenterRepository } from "src/database/repository/center/center.repository";
import { UserCenterRepository } from "src/database/repository/center/user-center.repository";
import { QueryOptions } from "src/database/repository/repository";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { DatabaseService } from "src/database/database.service";
import { CompanyInsertModel, CompanySelectModel, CompanyUpdateModel } from "src/database/schema/tables/company.table";

@Injectable()
export class CompanyService {
  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly centerRepository: CenterRepository,
    private readonly userCenterRepository: UserCenterRepository,
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService
  ) { }

  async findByCIF(cif: string, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.companyRepository.findByCIF(cif, { transaction });
    });
  }

  async create(companyInsertModel: CompanyInsertModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.companyRepository.create(companyInsertModel, { transaction });
    });
  }

  async update(id: number, companyUpdateModel: CompanyUpdateModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      await this.companyRepository.update(id, companyUpdateModel, { transaction });
      return await this.companyRepository.findOne(id, { transaction });
    });
  }

  async findOne(id: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.companyRepository.findOne(id, { transaction });
    });
  }

  async findAll(filter: Partial<CompanySelectModel>, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      const companies = await this.companyRepository.findAll(filter, { transaction }) as Array<CompanySelectModel>;
      const centerCounts = await this.centerRepository.countByCompany({ transaction });
      const userCounts = await this.userCenterRepository.countByCompany({ transaction });
      const centerCountByCompany = new Map(centerCounts.map((c) => [c.id_company, c.center_count]));
      const userCountsByCompany = new Map(userCounts.map((c) => [c.id_company, c]));
      for (const company of companies) {
        company.center_count = centerCountByCompany.get(company.id_company) ?? 0;
        const c = userCountsByCompany.get(company.id_company);
        company.user_count = c?.user_count ?? 0;
        company.main_user_count = c?.main_user_count ?? 0;
        company.active_count = c?.active_count ?? 0;
        company.inactive_count = c?.inactive_count ?? 0;
      }
      return companies;
    });
  }

  async delete(id: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.companyRepository.delete(id, { transaction });
    });
  }

  async findCentersByCompanyId(companyId: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.centerRepository.findByCompanyId(companyId, { transaction });
    });
  }
}