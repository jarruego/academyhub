import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { DatabaseService } from "src/database/database.service";
import { CenterRepository } from "src/database/repository/center/center.repository";
import { UserCenterRepository } from "src/database/repository/center/user-center.repository";
import { CompanyRepository } from "src/database/repository/company/company.repository";
import { QueryOptions } from "src/database/repository/repository";
import { CenterInsertModel, CenterSelectModel, CenterUpdateModel } from "src/database/schema/tables/center.table";
import { UserCenterInsertModel, UserCenterUpdateModel, userCenterTable } from "src/database/schema/tables/user_center.table";
import { UpdateUsersMainCenterDTO } from "src/dto/center/update-users-main-center.dto";
import { eq } from "drizzle-orm";
import { UserService } from "../user/user.service"; 

@Injectable()
export class CenterService {
  constructor(
    private readonly centerRepository: CenterRepository,
    private readonly userCenterRepository: UserCenterRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly userService: UserService,
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService,
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
      // Comprobar si el usuario ya pertenece a algún centro
      const existingCenters = await transaction
        .select()
        .from(userCenterTable)
        .where(eq(userCenterTable.id_user, userCenterInsertModel.id_user));
      let isMain = userCenterInsertModel.is_main_center;
      if (!existingCenters.length) {
        isMain = true;
      } else if (typeof isMain === 'undefined') {
        isMain = false;
      }
      return await this.centerRepository.addUserToCenter({
        ...userCenterInsertModel,
        is_main_center: isMain
      }, { transaction });
    });
  }

  async findUsersInCenter(centerId: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      // Obtén los registros user_center
      const userCenters = await this.userCenterRepository.findUsersInCenter(centerId, { transaction });
      // Para cada registro, consulta los datos completos del usuario
      const users = await Promise.all(
        userCenters.map(async (uc) => {
          const user = await this.userService.findById(uc.id_user, { transaction });
          return {
            ...user,
            is_main_center: uc.is_main_center,
            start_date: uc.start_date,
            end_date: uc.end_date
          };
        })
      );
      return users;
    });
  }

  async updateUserInCenter(id_center: number, id_user: number, userCenterUpdateModel: UserCenterUpdateModel, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.userCenterRepository.updateUserInCenter(id_center, id_user, userCenterUpdateModel, { transaction });
    });
  }

  async deleteUserFromCenter(id_center: number, id_user: number, options?: QueryOptions) {
    return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
      return await this.userCenterRepository.deleteUserFromCenter(id_center, id_user, { transaction });
    });
  }

  async getCompanyOfCenter(centerId: number) {
    return await (this.databaseService.db).transaction(async transaction => {
      const center = await this.centerRepository.findById(centerId, { transaction });
      if (!center) throw new NotFoundException(`Center with ID ${centerId} not found`);
      const company = await this.companyRepository.findOne(center.id_company, { transaction });
      if (!company) throw new NotFoundException(`Company with ID ${center.id_company} not found`);
      return company;
    });
  }

  async setUserMainCenter(userId: number, centerId: number, options?: QueryOptions) {
    await this.userCenterRepository.updateByUserId(userId, {
      is_main_center: false
    }, options);
    await this.userCenterRepository.updateById(userId, centerId, { is_main_center: true }, options);
  }

  async updateUsersMainCenters(userCenters: UpdateUsersMainCenterDTO['users']) {
    await this.databaseService.db.transaction(async (transaction) => {
      // Promise all: espera a que todas las llamadas a funciones asíncronas terminen
      // Dicho de otro modo: lanza en paralelo varias funciones
      await Promise.all(userCenters.map((u) => this.setUserMainCenter(u.userId, u.centerId, { transaction })));
    });
  }
}