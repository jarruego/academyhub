import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { DatabaseService } from "src/database/database.service";
import { CourseRepository } from "src/database/repository/course/course.repository";
import { GroupRepository } from "src/database/repository/group/group.repository";
import { UserGroupRepository } from "src/database/repository/group/user-group.repository";
import { UserRepository } from "src/database/repository/user/user.repository";
import type { UserMainCompanyCif } from "src/database/repository/user/user.repository";
import { CourseSelectModel } from "src/database/schema/tables/course.table";
import { GroupSelectModel } from "src/database/schema/tables/group.table";
import { UserSelectModel } from "src/database/schema/tables/user.table";
import { create } from 'xmlbuilder2';
// repository method will handle user_center/center/company joins
import type { FundaeCost, FundaeParticipant, FundaeGroup, FundaeRoot } from '../../types/fundae/fundae.types';

type CreateFundaeXmlObjectOptions = {
    course: CourseSelectModel;
    group: GroupSelectModel;
    users: (UserSelectModel)[];
}

@Injectable()
export class GroupBonificableService {
    constructor (
        @Inject(DATABASE_PROVIDER) 
        private readonly databaseService: DatabaseService, 
        private readonly groupRepository: GroupRepository, 
        private readonly userGroupRepository: UserGroupRepository,
        private readonly courseRepository: CourseRepository,
        private readonly userRepository: UserRepository) {}

    async generateBonificationFile(groupId: number, userIds: number[]) {
        return await this.databaseService.db.transaction(async (transaction) => {
            // Group info (FUNDAE ID)
            const group = await this.groupRepository.findById(groupId, { transaction });
            if (!group) throw new NotFoundException("Group does not exist");

            // Get course fundae id
            const course = await this.courseRepository.findById(group.id_course, { transaction });
            if (!course) throw new NotFoundException("Course not found");

            // Get group students
            const users = await this.userGroupRepository.findUsersInGroupByIds(group.id_group, userIds, { transaction });
            if (users.length <= 0) throw new BadRequestException("No users found in group");

            // Get each user's main-center company CIF from repository (DB ops moved to repository)
            const userCompanyRows = await this.userRepository.findUsersMainCompanyCifs(users.map(u => u.id_user), { transaction });

            const cifToUsers: Record<string, Set<number>> = {};
            for (const row of userCompanyRows as UserMainCompanyCif[]) {
                const { id_user: uid, cif } = row;
                if (!cif || !uid) continue;
                if (!cifToUsers[cif]) cifToUsers[cif] = new Set<number>();
                cifToUsers[cif].add(uid);
            }

            const pricePerHour = Number(course.price_per_hour ?? 0);
            const hours = Number(course.hours ?? 0);
            const costPerUserRaw = pricePerHour * hours;

            const costesArray: FundaeCost[] = [];
            for (const [cif, userSet] of Object.entries(cifToUsers)) {
                const alumnosBonificados = userSet.size;
                // Total cost for this CIF: horas * precioHora * alumnosBonificados, rounded to integer
                const costeTotal = Math.round(costPerUserRaw * alumnosBonificados);

                // Split: 70% / 15% / 10% / 5% — round components to integers and ensure sum equals costeTotal
                let directos = Math.round(costeTotal * 0.70);
                let indirectos = Math.round(costeTotal * 0.15);
                let organizacion = Math.round(costeTotal * 0.10);
                // assign remainder to salariales so total matches (handles rounding drift)
                let salariales = costeTotal - (directos + indirectos + organizacion);

                // In rare case of negative remainder adjust directos
                if (salariales < 0) {
                    directos += salariales; // salariales is negative
                    salariales = 0;
                }

                costesArray.push({
                    cifagrupada: cif,
                    directos,
                    indirectos,
                    organizacion,
                    salariales,
                });
            }

            const xml = create(GroupBonificableService.createFundaeXmlObject({ course, group, users, costes: costesArray })).dec({ version: '1.0', encoding: 'UTF-8', standalone: true}).end({ prettyPrint: true });
            // Devuelve también el nombre sugerido para el archivo
            return { xml, filename: `${group.group_name.replace(/[^a-zA-Z0-9_-]/g, '_')}.xml` };
        });
    }

    // Creates the base object to generate the XML
    static createFundaeXmlObject({ course, group, users, costes }: CreateFundaeXmlObjectOptions & { costes?: FundaeCost[] }) {

        // Error handling
        const courseFundaeId = +course.fundae_id;
        const groupFundaeId = +group.fundae_id;

        if (isNaN(courseFundaeId) || isNaN(groupFundaeId)) throw new InternalServerErrorException("Fundae ID was not a number");

        // Generate participants array
        const participantes: FundaeParticipant[] = users.map((user) => {
            if (!user.dni) throw new InternalServerErrorException(`User ${user.id_user} does not have DNI`);

            // Map document type strings to FUNDAE numeric codes (10 for DNI, 60 for NIE)
            const docTypeStr = (user.document_type ?? '').toString().toUpperCase();
            let docTypeCode = 10; // default to DNI
            if (docTypeStr === 'NIE') docTypeCode = 60;
            else if (docTypeStr === 'DNI') docTypeCode = 10;

            // Normalize DiplomaAcreditativo: default MUST be 'S' per spec/request
            const rawDiploma = user.accreditationDiploma;
            let diplomaValue = 'S'; // default to 'S' when missing/unknown
            if (typeof rawDiploma === 'boolean') {
                diplomaValue = rawDiploma ? 'S' : 'N';
            } else if (typeof rawDiploma === 'number') {
                diplomaValue = rawDiploma === 1 ? 'S' : 'N';
            } else if (typeof rawDiploma === 'string') {
                const v = rawDiploma.trim().toUpperCase();
                if (['S', 'SI', 'Y', 'YES', 'TRUE', '1'].includes(v)) diplomaValue = 'S';
                else diplomaValue = 'N';
            } else {
                diplomaValue = 'S';
            }

            return {
                nif: user.dni,
                N_TIPO_DOCUMENTO: docTypeCode,
                ERTE_RD_ley: user.erteLaw,
                email: user.email,
                telefono: user.phone,
                discapacidad: user.disability,
                afectadosTerrorismo: user.terrorism_victim,
                afectadosViolenciaGenero: user.gender_violence_victim,
                categoriaprofesional: user.salary_group,
                nivelestudios: user.education_level,
                DiplomaAcreditativo: diplomaValue,
                fijoDiscontinuo: user.seasonalWorker,
            };
        });

        const obj: FundaeRoot = {
            grupos: {
                grupo: {
                    idAccion: String(courseFundaeId),
                    idGrupo: String(groupFundaeId),
                    participantes,
                }
            }
        };

        if (costes && costes.length > 0) {
            obj.grupos.grupo.costes = { coste: costes };
        }

        return obj;
    }
}