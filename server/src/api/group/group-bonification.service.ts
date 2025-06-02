import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { DatabaseService } from "src/database/database.service";
import { CourseRepository } from "src/database/repository/course/course.repository";
import { GroupRepository } from "src/database/repository/group/group.repository";

@Injectable()
export class GroupBonificableService {
    constructor (@Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService, private readonly groupRepository: GroupRepository, private readonly courseRepository: CourseRepository) {}

    async generateBonificationFile(groupId: number, userIds: number[]) {
        return await this.databaseService.db.transaction(async (transaction) => {
            // Info del grupo (ID FUNDAE)
            const group = await this.groupRepository.findById(groupId, { transaction });
            if (!group) throw new NotFoundException("Group does not exist");

            const { fundae_id: groupFundaeId } = group;

            // Obtener id fundae de los curso
            const course = await this.courseRepository.findById(group.id_course, { transaction });
            if (!course) throw new NotFoundException("Course not found");

            const { fundae_id: courseFundaeId } = course;

            // Obtenemos los alumnos del grupo
            const users = await this.groupRepository.findUsersInGroup(group.id_group, { transaction });
            if (users.length <= 0) throw new BadRequestException("No users found in group");

            // Calcular coste total por alumno
            //const costPerUser = course.price_per_hour * course.hours;
        });
    }
}