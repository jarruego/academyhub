import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { DatabaseService } from "src/database/database.service";
import { CourseRepository } from "src/database/repository/course/course.repository";
import { GroupRepository } from "src/database/repository/group/group.repository";
import { CourseSelectModel } from "src/database/schema/tables/course.table";
import { GroupSelectModel } from "src/database/schema/tables/group.table";
import { UserSelectModel } from "src/database/schema/tables/user.table";
import { create } from 'xmlbuilder2';

type CreateFundaeXmlObjectOptions = {
    course: CourseSelectModel;
    group: GroupSelectModel;
    users: UserSelectModel[];
}

@Injectable()
export class GroupBonificableService {
    constructor (@Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService, private readonly groupRepository: GroupRepository, private readonly courseRepository: CourseRepository) {}

    async generateBonificationFile(groupId: number, userIds: number[]) {
        return await this.databaseService.db.transaction(async (transaction) => {
            // Group info (FUNDAE ID)
            const group = await this.groupRepository.findById(groupId, { transaction });
            if (!group) throw new NotFoundException("Group does not exist");

            // Get course fundae id
            const course = await this.courseRepository.findById(group.id_course, { transaction });
            if (!course) throw new NotFoundException("Course not found");

            // Get group students
            const users = await this.groupRepository.findUsersInGroupByIds(group.id_group, userIds, { transaction });
            if (users.length <= 0) throw new BadRequestException("No users found in group");

            const xml = create(GroupBonificableService.createFundaeXmlObject({ course, group, users })).end({ prettyPrint: true });
            return xml;
        });
    }

    // Creates the base object to generate the XML
    static createFundaeXmlObject({ course, group, users }: CreateFundaeXmlObjectOptions) {
        // Calculate total cost per user
        const costPerUser = (course.price_per_hour ?? 0) * course.hours;

        // Error handling
        const courseFundaeId = +course.fundae_id;
        const groupFundaeId = +group.fundae_id;

        if (isNaN(courseFundaeId) || isNaN(groupFundaeId)) throw new InternalServerErrorException("Fundae ID was not a number");

        // Generate participants array
        const participantes = users.map((user) => {
            if (!user.dni) throw new InternalServerErrorException(`User ${user.id_user} does not have DNI`);

            return {
                nif: user.dni,
                N_TIPO_DOCUMENTO: user.document_type,
                ERTE_RD_ley: user.erteLaw,
                email: user.email,
                telefono: user.phone,
                discapacidad: user.disability,
                afectadosTerrorismo: user.terrorism_victim,
                afectadosViolenciaGenero: user.gender_violence_victim,
                categoriaprofesional: user.professional_category,
                nivelestudios: user.education_level,
                DiplomaAcreditativo: user.accreditationDiploma,
                fijoDiscontinuo: user.seasonalWorker,
            }
        });

        // Generate object
        const obj = {
            grupos: {
                grupo: {
                    idAccion: minStringDigits(courseFundaeId),
                    idGrupo: minStringDigits(groupFundaeId),
                    participantes,
                }
            }
        };

        return obj;
    }
}

// minStringDigits: Converts a number to a string and pads it with leading zeros until it reaches the specified minimum length.
const minStringDigits = (num: number, min: number = 5): string => {
  return num.toString().padStart(min, '0');
};