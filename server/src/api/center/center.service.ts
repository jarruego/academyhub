import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { DatabaseService } from "src/database/database.service";
import { CenterRepository } from "src/database/repository/center/center.repository";
import { CompanyRepository } from "src/database/repository/company/company.repository";
import { QueryOptions } from "src/database/repository/repository";
import { CenterInsertModel, CenterSelectModel, CenterUpdateModel } from "src/database/schema/tables/center.table";
import { UserCenterInsertModel, UserCenterUpdateModel } from "src/database/schema/tables/user_center.table";

@Injectable()
export class CenterService {
  constructor(
    private readonly centerRepository: CenterRepository,
    private readonly companyRepository: CompanyRepository,
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService
  ) { }

  async findById(id: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.centerRepository.findById(id, { transaction });
    });
  }

  async findAll(filter: CenterSelectModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      const centers = await this.centerRepository.findAll(filter, { transaction }) as Array<CenterSelectModel>;
      for (const center of centers) {
        const company = await this.companyRepository.findOne(center.id_company, { transaction });
        center.company_name = company?.company_name;
      }
      return centers;
    });
  }

  async create(centerInsertModel: CenterInsertModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      const company = await this.companyRepository.findOne(centerInsertModel.id_company, { transaction });
      if (!company) {
        throw new NotFoundException(`Company with ID ${centerInsertModel.id_company} not found`);
      }
      return await this.centerRepository.create(centerInsertModel, { transaction });
    });
  }

  async update(id: number, centerUpdateModel: CenterUpdateModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      const company = await this.companyRepository.findOne(centerUpdateModel.id_company, { transaction });
      if (!company) {
        throw new NotFoundException(`Company with ID ${centerUpdateModel.id_company} not found`);
      }
      await this.centerRepository.update(id, centerUpdateModel, { transaction });
      return await this.centerRepository.findById(id, { transaction });
    });
  }

  async deleteById(id: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      const center = await this.centerRepository.findById(id, { transaction });
      if (!center) {
        throw new NotFoundException(`Center with ID ${id} not found`);
      }
      return await this.centerRepository.deleteById(id, { transaction });
    });
  }

  async addUserToCenter(userCenterInsertModel: UserCenterInsertModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.centerRepository.addUserToCenter(userCenterInsertModel, { transaction });
    });
  }

  async findUsersInCenter(centerId: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.centerRepository.findUsersInCenter(centerId, { transaction });
    });
  }

  async updateUserInCenter(id_center: number, id_user: number, userCenterUpdateModel: UserCenterUpdateModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.centerRepository.updateUserInCenter(id_center, id_user, userCenterUpdateModel, { transaction });
    });
  }

  async deleteUserFromCenter(id_center: number, id_user: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.centerRepository.deleteUserFromCenter(id_center, id_user, { transaction });
    });
  }
}