import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConsultingJobPositionGroupRepository } from "src/database/repository/consultoria/consulting-job-position-group.repository";
import { CreateConsultingJobPositionGroupDto } from "./dto/create-consulting-job-position-group.dto";
import { UpdateConsultingJobPositionGroupDto } from "./dto/update-consulting-job-position-group.dto";

// drizzle-orm envuelve el error de pg en un DrizzleQueryError — el código de
// postgres (23503 = violación de FK) va en `.cause.code`, no en `.code`
// directamente.
function isForeignKeyViolation(error: unknown): boolean {
  const err = error as { code?: string; cause?: { code?: string } };
  return err?.code === "23503" || err?.cause?.code === "23503";
}

@Injectable()
export class ConsultingJobPositionGroupService {
  constructor(private readonly consultingJobPositionGroupRepository: ConsultingJobPositionGroupRepository) {}

  async create(dto: CreateConsultingJobPositionGroupDto) {
    return this.consultingJobPositionGroupRepository.create(dto);
  }

  async findAll() {
    return this.consultingJobPositionGroupRepository.findAll();
  }

  async findById(id_job_position_group: number) {
    const group = await this.consultingJobPositionGroupRepository.findById(id_job_position_group);
    if (!group) throw new NotFoundException("Grupo de puesto no encontrado");
    return group;
  }

  async update(id_job_position_group: number, dto: UpdateConsultingJobPositionGroupDto) {
    await this.findById(id_job_position_group);
    return this.consultingJobPositionGroupRepository.update(id_job_position_group, dto);
  }

  async remove(id_job_position_group: number) {
    await this.findById(id_job_position_group);
    try {
      await this.consultingJobPositionGroupRepository.remove(id_job_position_group);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException("No se puede borrar: hay puestos de trabajo que usan este grupo.");
      }
      throw error;
    }
    return { success: true };
  }
}
