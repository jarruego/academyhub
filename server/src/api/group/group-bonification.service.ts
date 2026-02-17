import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { DatabaseService } from "src/database/database.service";
import { CourseRepository } from "src/database/repository/course/course.repository";
import { GroupRepository } from "src/database/repository/group/group.repository";
import { UserGroupRepository } from "src/database/repository/group/user-group.repository";
import { CourseSelectModel } from "src/database/schema/tables/course.table";
import { GroupSelectModel } from "src/database/schema/tables/group.table";
import type { UserWithEnrollmentInfo } from "src/database/repository/group/user-group.repository";
import { create } from 'xmlbuilder2';
// repository method will handle user_center/center/company joins
import type { FundaeCost, FundaeParticipant, FundaeGroup, FundaeRoot } from '../../types/fundae/fundae.types';

type CreateFundaeXmlObjectOptions = {
    course: CourseSelectModel;
    group: GroupSelectModel;
    users: (UserWithEnrollmentInfo)[];
}

@Injectable()
export class GroupBonificableService {
    constructor (
        @Inject(DATABASE_PROVIDER) 
        private readonly databaseService: DatabaseService, 
        private readonly groupRepository: GroupRepository, 
        private readonly userGroupRepository: UserGroupRepository,
        private readonly courseRepository: CourseRepository) {}

    async generateBonificationFile(groupId: number, userIds: number[]) {
        return await this.databaseService.db.transaction(async (transaction) => {
            // Group info (FUNDAE ID)
            const group = await this.groupRepository.findById(groupId, { transaction });
            if (!group) throw new NotFoundException("Group does not exist");

            // Get course fundae id
            const course = await this.courseRepository.findById(group.id_course, { transaction });
            if (!course) throw new NotFoundException("Course not found");
            if (!course.fundae_id || isNaN(Number(course.fundae_id))) {
                throw new BadRequestException("Course FUNDAE ID is missing or invalid");
            }
            if (!group.fundae_id || isNaN(Number(group.fundae_id))) {
                throw new BadRequestException("Group FUNDAE ID is missing or invalid");
            }

            // Get group students
            const users = await this.userGroupRepository.findUsersInGroupByIds(group.id_group, userIds, { transaction });
            if (users.length <= 0) throw new BadRequestException("No users found in group");

            const usersMissingDni = users
                .filter((user) => !user.dni || String(user.dni).trim().length === 0)
                .map((user) => ({ id_user: user.id_user, email: user.email }))
                .filter((user) => user.id_user || user.email);

            if (usersMissingDni.length > 0) {
                throw new BadRequestException({
                    message: "Some users are missing DNI",
                    usersMissingDni,
                });
            }

            // Determine company CIF based on the center at the time of enrollment
            // The repository now returns enrollment_company_cif on each user (from user_group.id_center -> centers -> company.cif)
            const cifToUsers: Record<string, Set<number>> = {};
            for (const user of users) {
                const uid = user.id_user;
                const cif = String(user.enrollment_company_cif ?? '');
                if (!cif || !uid) continue;
                if (!cifToUsers[cif]) cifToUsers[cif] = new Set<number>();
                cifToUsers[cif].add(uid as number);
            }

            const pricePerHour = Number(course.price_per_hour ?? 0);
            const hours = Number(course.hours ?? 0);
            const costPerUserRaw = pricePerHour * hours;

            // Get current month for periodos
            const currentMonth = new Date().getMonth() + 1; // 1-12

            const costesArray: FundaeCost[] = [];
            for (const [cif, userSet] of Object.entries(cifToUsers)) {
                const alumnosBonificados = userSet.size;
                // Total cost for this CIF: horas * precioHora * alumnosBonificados, rounded to integer
                const costeTotal = Math.round(costPerUserRaw * alumnosBonificados);

                // Only directos and salariales: indirectos and organizacion are always 0
                let directos = costeTotal;
                let indirectos = 0;
                let organizacion = 0;
                let salariales = 0;

                costesArray.push({
                    cifagrupada: cif,
                    directos,
                    indirectos,
                    organizacion,
                    salariales,
                    periodos: {
                        periodo: [
                            {
                                mes: currentMonth,
                                importe: salariales,
                            },
                        ],
                    },
                });
            }

            const xml = create(GroupBonificableService.createFundaeXmlObject({ course, group, users, costes: costesArray })).dec({ version: '1.0', encoding: 'UTF-8', standalone: true}).end({ prettyPrint: true });
            
            // Format decimal numbers in XML: ensure all numeric values have .00 format for FUNDAE compliance
            const xmlString = xml.replace(/(<(?:directos|indirectos|organizacion|salariales|importe)>)(\d+)(<\/(?:directos|indirectos|organizacion|salariales|importe)>)/g, (match, open, num, close) => {
                return `${open}${Number(num).toFixed(2)}${close}`;
            });
            
            // Devuelve también el nombre sugerido para el archivo
            return { xml: xmlString, filename: `${group.group_name.replace(/[^a-zA-Z0-9_-]/g, '_')}.xml` };
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
                categoriaprofesional: 5, // hardcoded to 5 for now antes user.salary_group
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
                    participantes: {
                        participante: participantes,
                    },
                }
            }
        };

        if (costes && costes.length > 0) {
            obj.grupos.grupo.costes = { coste: costes };
        }

        return obj;
    }
}